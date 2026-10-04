import type { ConstructionAttempt } from './construction-attempt';
import type {
  PlayerConstructionRepository,
  PlayerConstructionSource,
  PlayerConstructionWriteResult,
} from './player-construction-repository';

type WriteResult = PlayerConstructionWriteResult | { readonly status: 'ignored' };
interface Token {
  active: boolean;
  valid: boolean;
}
interface Queue {
  readonly scope: PlayerConstructionSource['scope'];
  tail: Promise<void>;
  token: Token;
}

/** One instance coordinates all construction sessions sharing a repository. */
export const createPlayerConstructionWrites = (repository: PlayerConstructionRepository) => {
  const queues = new Map<string, Queue>();
  let campaignBarrier = Promise.resolve();
  const enqueue = <T>(queue: Queue, operation: () => Promise<T>): Promise<T> => {
    const result = queue.tail.then(operation);
    queue.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const safeWrite = async (
    operation: () => Promise<PlayerConstructionWriteResult>,
  ): Promise<PlayerConstructionWriteResult> => {
    try {
      return await operation();
    } catch {
      return { status: 'error', code: 'storage-unavailable' };
    }
  };

  return {
    open(source: PlayerConstructionSource) {
      const key = `${source.scope}:${source.levelId}`;
      const token: Token = { active: false, valid: true };
      const existing = queues.get(key);
      if (existing !== undefined) existing.token.valid = false;
      const queue: Queue = existing ?? { scope: source.scope, tail: Promise.resolve(), token };
      queue.token = token;
      queues.set(key, queue);
      const barrier = source.scope === 'campaign' ? campaignBarrier : Promise.resolve();
      const ready = enqueue(queue, async () => {
        await barrier;
        if (queue.token !== token) return { status: 'error', code: 'storage-unavailable' } as const;
        const result = await repository
          .load(source)
          .catch(() => ({ status: 'error', code: 'storage-unavailable' }) as const);
        token.active = result.status === 'ok' && queue.token === token;
        return result;
      });
      return {
        ready,
        save(attempt: ConstructionAttempt): Promise<WriteResult> {
          if (!token.active || !token.valid || queue.token !== token)
            return Promise.resolve({ status: 'ignored' });
          return enqueue(queue, () => safeWrite(() => repository.save(source, attempt)));
        },
        restart(): Promise<PlayerConstructionWriteResult> {
          if (queue.token !== token)
            return Promise.resolve({ status: 'error', code: 'storage-unavailable' });
          const wasActive = token.active;
          token.valid = false;
          return enqueue(queue, async () => {
            const result = await safeWrite(() => repository.delete(source));
            if (result.status === 'error' && queue.token === token) {
              token.valid = true;
              token.active = wasActive;
            }
            return result;
          });
        },
      };
    },
    async flush(): Promise<void> {
      let settled = false;
      while (!settled) {
        const current = [...queues.values()].map((queue) => ({ queue, tail: queue.tail }));
        await Promise.all(current.map(({ tail }) => tail));
        settled =
          current.length === queues.size && current.every(({ queue, tail }) => queue.tail === tail);
      }
    },
    async resetCampaign<T extends { readonly status: 'ok' | 'error' }>(
      operation: () => Promise<T>,
    ): Promise<T> {
      const previousBarrier = campaignBarrier;
      let release!: () => void;
      campaignBarrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const campaign = [...queues.values()].filter(({ scope }) => scope === 'campaign');
      const tokens = campaign.map((queue) => ({
        queue,
        token: queue.token,
        valid: queue.token.valid,
      }));
      tokens.forEach(({ token }) => {
        token.valid = false;
      });
      const tails = campaign.map(({ tail }) => tail);
      let succeeded = false;
      try {
        await previousBarrier;
        await Promise.all(tails);
        const result = await operation();
        succeeded = result.status === 'ok';
        return result;
      } finally {
        if (!succeeded)
          tokens.forEach(({ queue, token, valid }) => {
            if (queue.token === token) token.valid = valid;
          });
        release();
      }
    },
  };
};

type PlayerConstructionWrites = ReturnType<typeof createPlayerConstructionWrites>;
export type PlayerConstructionWriter = ReturnType<PlayerConstructionWrites['open']>;

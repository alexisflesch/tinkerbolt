import { describe, expect, it, vi } from 'vitest';
import { embeddedLevels } from '../../content/embedded-levels';
import { createConstructionAttempt } from './construction-attempt';
import type {
  PlayerConstructionRepository,
  PlayerConstructionSource,
} from './player-construction-repository';
import { createPlayerConstructionWrites } from './player-construction-writes';

const document = embeddedLevels[0];
if (document === undefined) throw new Error('Missing level');
const source: PlayerConstructionSource = {
  scope: 'campaign',
  levelId: document.id,
  sourceFingerprint: 'a'.repeat(64),
  document,
};
const attempt = createConstructionAttempt(document);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const repository = () => ({
  load: vi
    .fn<PlayerConstructionRepository['load']>()
    .mockResolvedValue({ status: 'ok', attempt: null }),
  save: vi.fn<PlayerConstructionRepository['save']>().mockResolvedValue({ status: 'ok' }),
  delete: vi.fn<PlayerConstructionRepository['delete']>().mockResolvedValue({ status: 'ok' }),
});

describe('ordre et barrières des écritures de construction', () => {
  it('sérialise chaque engagement et draine avant la navigation', async () => {
    const repo = repository();
    const writes = createPlayerConstructionWrites(repo);
    const first = deferred<{ status: 'ok' }>();
    const calls: number[] = [];
    repo.save = vi
      .fn()
      .mockImplementationOnce(() => {
        calls.push(1);
        return first.promise;
      })
      .mockImplementationOnce(() => {
        calls.push(2);
        return Promise.resolve({ status: 'ok' });
      });
    const writer = writes.open(source);
    await writer.ready;
    const one = writer.save(attempt);
    const two = writer.save(attempt);
    await Promise.resolve();
    expect(calls).toEqual([1]);
    let drained = false;
    const flush = writes.flush().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    first.resolve({ status: 'ok' as const });
    await Promise.all([one, two, flush]);
    expect(calls).toEqual([1, 2]);
    expect(drained).toBe(true);
  });

  it('invalide les nouveaux engagements puis attend les écritures engagées avant recommencement', async () => {
    const repo = repository();
    const writes = createPlayerConstructionWrites(repo);
    const pending = deferred<{ status: 'ok' }>();
    repo.save = vi.fn(() => pending.promise);
    const writer = writes.open(source);
    await writer.ready;
    const save = writer.save(attempt);
    await Promise.resolve();
    const reset = writer.restart();
    expect(await writer.save(attempt)).toEqual({ status: 'ignored' });
    expect(repo.delete).not.toHaveBeenCalled();
    pending.resolve({ status: 'ok' as const });
    await save;
    expect(await reset).toEqual({ status: 'ok' as const });
    expect(repo.delete).toHaveBeenCalledExactlyOnceWith(source);
    expect(await writer.save(attempt)).toEqual({ status: 'ignored' });
  });

  it('réactive la session si l’effacement échoue et retente sans faux succès', async () => {
    const repo = repository();
    repo.delete = vi
      .fn()
      .mockResolvedValueOnce({ status: 'error' as const, code: 'quota-exceeded' })
      .mockResolvedValueOnce({ status: 'ok' as const });
    const writes = createPlayerConstructionWrites(repo);
    const writer = writes.open(source);
    await writer.ready;
    expect(await writer.restart()).toEqual({ status: 'error' as const, code: 'quota-exceeded' });
    expect(await writer.save(attempt)).toEqual({ status: 'ok' as const });
    expect(await writer.restart()).toEqual({ status: 'ok' as const });
  });

  it('attend l’ancienne route avant lecture et ignore ses engagements tardifs', async () => {
    const repo = repository();
    const pending = deferred<{ status: 'ok' }>();
    repo.save = vi.fn(() => pending.promise);
    const writes = createPlayerConstructionWrites(repo);
    const old = writes.open(source);
    await old.ready;
    const save = old.save(attempt);
    await Promise.resolve();
    const next = writes.open(source);
    expect(repo.load).toHaveBeenCalledTimes(1);
    expect(await old.save(attempt)).toEqual({ status: 'ignored' });
    pending.resolve({ status: 'ok' as const });
    await save;
    await next.ready;
    expect(repo.load).toHaveBeenCalledTimes(2);
  });

  it('ne réécrit jamais une construction dont la lecture a échoué', async () => {
    const repo = repository();
    repo.load = vi.fn<PlayerConstructionRepository['load']>().mockResolvedValue({
      status: 'error',
      code: 'unsupported-version',
    });
    const writer = createPlayerConstructionWrites(repo).open(source);
    expect(await writer.ready).toEqual({
      status: 'error' as const,
      code: 'unsupported-version' as const,
    });
    expect(await writer.save(attempt)).toEqual({ status: 'ignored' });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('draine la campagne et invalide les anciennes sessions avant le reset sans toucher aux reçus', async () => {
    const repo = repository();
    const writes = createPlayerConstructionWrites(repo);
    const campaign = writes.open(source);
    const received = writes.open({
      ...source,
      scope: 'received',
      levelId: 'recu-0123456789abcdef',
    });
    await Promise.all([campaign.ready, received.ready]);
    const pending = deferred<{ status: 'ok' }>();
    repo.save = vi.fn(() => pending.promise);
    const save = campaign.save(attempt);
    await Promise.resolve();
    const clear = vi.fn(() => Promise.resolve({ status: 'ok' as const }));
    const reset = writes.resetCampaign(clear);
    expect(await campaign.save(attempt)).toEqual({ status: 'ignored' });
    expect(clear).not.toHaveBeenCalled();
    pending.resolve({ status: 'ok' as const });
    await save;
    await reset;
    expect(clear).toHaveBeenCalledOnce();
    expect(await campaign.save(attempt)).toEqual({ status: 'ignored' });
    expect(await received.save(attempt)).toEqual({ status: 'ok' as const });
  });

  it('garde les sessions utilisables après un reset campagne échoué', async () => {
    const repo = repository();
    const writes = createPlayerConstructionWrites(repo);
    const writer = writes.open(source);
    await writer.ready;
    expect(
      await writes.resetCampaign(() =>
        Promise.resolve({
          status: 'error' as const,
          code: 'quota-exceeded',
        }),
      ),
    ).toEqual({ status: 'error' as const, code: 'quota-exceeded' });
    expect(await writer.save(attempt)).toEqual({ status: 'ok' as const });
  });

  it('invalide aussi une lecture déjà en cours au moment du reset', async () => {
    const repo = repository();
    const reading = deferred<{ status: 'ok'; attempt: null }>();
    repo.load = vi.fn(() => reading.promise);
    const writes = createPlayerConstructionWrites(repo);
    const writer = writes.open(source);
    await Promise.resolve();
    await Promise.resolve();
    const reset = writes.resetCampaign(() => Promise.resolve({ status: 'ok' as const }));
    reading.resolve({ status: 'ok' as const, attempt: null });
    await writer.ready;
    await reset;
    expect(await writer.save(attempt)).toEqual({ status: 'ignored' });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('draine aussi un engagement arrivé pendant l’attente de navigation', async () => {
    const repo = repository();
    const writes = createPlayerConstructionWrites(repo);
    const writer = writes.open(source);
    await writer.ready;
    const one = deferred<{ status: 'ok' }>();
    const two = deferred<{ status: 'ok' }>();
    const started = deferred<undefined>();
    repo.save = vi
      .fn()
      .mockImplementationOnce(() => one.promise)
      .mockImplementationOnce(() => {
        started.resolve(undefined);
        return two.promise;
      });
    const first = writer.save(attempt);
    await Promise.resolve();
    let drained = false;
    const flush = writes.flush().then(() => {
      drained = true;
    });
    const second = writer.save(attempt);
    one.resolve({ status: 'ok' });
    await first;
    await started.promise;
    await Promise.resolve();
    expect(drained).toBe(false);
    two.resolve({ status: 'ok' });
    await second;
    await flush;
    expect(drained).toBe(true);
  });
});

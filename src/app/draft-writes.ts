import type { DraftRepository } from '../application/drafts/draft-repository';

const allPending = new Set<Promise<void>>();
const pending = new WeakMap<DraftRepository, Map<string | symbol, Promise<void>>>();
/** Every engaged snapshot runs in order, including snapshots committed during first insertion. */
export function orderDraftWrite<T>(
  repository: DraftRepository,
  key: string | symbol,
  write: () => Promise<T>,
): Promise<T> {
  let queue = pending.get(repository);
  if (queue === undefined) {
    queue = new Map();
    pending.set(repository, queue);
  }
  const previous = queue.get(key);
  const result = previous === undefined ? write() : previous.then(write);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  queue.set(key, tail);
  allPending.add(tail);
  void tail.then(() => {
    allPending.delete(tail);
    if (queue.get(key) === tail) queue.delete(key);
  });
  return result;
}
export async function awaitDraftWrites(repository?: DraftRepository): Promise<void> {
  if (repository === undefined) {
    while (allPending.size > 0) await Promise.all(allPending);
    return;
  }
  const queue = pending.get(repository);
  while (queue !== undefined && queue.size > 0) await Promise.all(queue.values());
}

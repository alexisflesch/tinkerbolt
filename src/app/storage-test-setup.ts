import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
});

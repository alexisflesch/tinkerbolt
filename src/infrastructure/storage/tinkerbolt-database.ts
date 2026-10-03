import Dexie from 'dexie';

interface TinkerboltDatabaseOptions {
  readonly name?: string;
  readonly indexedDB?: IDBFactory;
  readonly IDBKeyRange?: typeof IDBKeyRange;
}

/** The schema is deliberately confined to infrastructure. */
export const createTinkerboltDatabase = ({
  name = 'tinkerbolt',
  indexedDB,
  IDBKeyRange: keyRange,
}: TinkerboltDatabaseOptions = {}): Dexie => {
  const db = new Dexie(name, {
    ...(indexedDB === undefined ? {} : { indexedDB }),
    ...(keyRange === undefined ? {} : { IDBKeyRange: keyRange }),
  });
  db.version(1).stores({
    creations: 'id,updatedAt',
    receivedLevels: 'id,receivedAt',
    progress: 'id',
    preferences: 'id',
    playerConstructions: '[scope+levelId],scope',
    backups: '++id',
  });
  db.on('ready', () => {
    if (db.backendDB().version > 10) {
      throw new DOMException('La base utilise une version plus récente.', 'VersionError');
    }
  });
  return db;
};

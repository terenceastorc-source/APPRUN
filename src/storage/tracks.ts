import type { TrackPoint } from '../domain/geo';

/**
 * Traces GPS stockées dans IndexedDB : une trace d'une heure pèse ~50 Ko,
 * trop pour localStorage (limité à ~5 Mo) sur la durée.
 */
const DB_NAME = 'apprun';
const STORE = 'tracks';

export interface StoredTrack {
  activityId: string;
  /** Portions actives (les pauses séparent les portions). */
  segments: TrackPoint[][];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'activityId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const trackStore = {
  save: (track: StoredTrack) => run('readwrite', (s) => s.put(track)).then(() => undefined),
  get: (activityId: string) => run<StoredTrack | undefined>('readonly', (s) => s.get(activityId) as IDBRequest<StoredTrack | undefined>),
  remove: (activityId: string) => run('readwrite', (s) => s.delete(activityId)).then(() => undefined),
  all: () => run<StoredTrack[]>('readonly', (s) => s.getAll() as IDBRequest<StoredTrack[]>),
  clear: () => run('readwrite', (s) => s.clear()).then(() => undefined),
};

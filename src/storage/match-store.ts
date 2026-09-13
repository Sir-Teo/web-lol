const DATABASE = 'rift-local-matches';
const STORE = 'checkpoints';

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(new Error('Browser storage is unavailable.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other game tabs and try again.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export async function readMatch(key: string): Promise<string | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(key);
      transaction.oncomplete = () => {
        if (request.result !== undefined && typeof request.result !== 'string')
          reject(new Error('Saved match could not be read.'));
        else resolve(request.result);
      };
      transaction.onabort = () => reject(new Error('Saved match could not be read.'));
    });
  } finally {
    db.close();
  }
}

export async function writeMatch(key: string, snapshot: string | null): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      if (snapshot === null) store.delete(key);
      else store.put(snapshot, key);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(new Error('Saved match could not be updated. Check available browser storage.'));
    });
  } finally {
    db.close();
  }
}

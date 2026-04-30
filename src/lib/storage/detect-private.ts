const PROBE_KEY = "__vucible_private_probe__";

export async function isPrivateBrowsing(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (!testLocalStorage()) return true;
  if (!(await testIndexedDB())) return true;

  return false;
}

function testLocalStorage(): boolean {
  try {
    window.localStorage.setItem(PROBE_KEY, "1");
    window.localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function testIndexedDB(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("__vucible_idb_probe__");
      req.onsuccess = () => {
        req.result.close();
        indexedDB.deleteDatabase("__vucible_idb_probe__");
        resolve(true);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

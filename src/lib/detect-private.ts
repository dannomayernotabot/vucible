const PROBE_KEY = "__vucible_private_probe__";

export function detectPrivateBrowsing(): boolean {
  try {
    localStorage.setItem(PROBE_KEY, "1");
    localStorage.removeItem(PROBE_KEY);
  } catch {
    return true;
  }

  try {
    const req = indexedDB.open("__vucible_probe__");
    req.onsuccess = () => {
      req.result.close();
      indexedDB.deleteDatabase("__vucible_probe__");
    };
  } catch {
    return true;
  }

  return false;
}

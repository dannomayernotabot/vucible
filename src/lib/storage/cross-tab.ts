import { getStorage } from "./keys";

type StorageChangeHandler = () => void;

export function listenForStorageChanges(handler: StorageChangeHandler): () => void {
  function onStorage(e: StorageEvent) {
    if (e.key === "vucible:v1") {
      handler();
    }
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

let broadcastChannel: BroadcastChannel | null = null;

export function notifyOtherTabs(message: string): void {
  try {
    if (!broadcastChannel) {
      broadcastChannel = new BroadcastChannel("vucible");
    }
    broadcastChannel.postMessage({ type: "settings-changed", message });
  } catch {
    // BroadcastChannel not available
  }
}

export function listenForBroadcast(
  handler: (msg: { type: string; message: string }) => void,
): () => void {
  try {
    const channel = new BroadcastChannel("vucible");
    channel.onmessage = (e) => {
      if (e.data && typeof e.data.type === "string") {
        handler(e.data);
      }
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}

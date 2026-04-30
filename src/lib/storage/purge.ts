import { openHistoryDB } from "./history";

export async function clearHistory(): Promise<void> {
  const db = await openHistoryDB();
  const tx = db.transaction(["sessions", "rounds"], "readwrite");
  await Promise.all([tx.objectStore("sessions").clear(), tx.objectStore("rounds").clear()]);
  await tx.done;
}

import { promises as fs } from "fs";
import path from "path";
import { PRODUCTS_FILE } from "@/app/lib/productsStore";
import { getConfig, saveConfig } from "@/app/lib/storage";

/* -------------------- Pfade -------------------- */

const APP_DATA_DIR = process.env.APP_DATA_DIR?.trim();
const DATA_DIR = APP_DATA_DIR ? APP_DATA_DIR : path.join(process.cwd(), "data");

const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const MAX_SNAPSHOTS = 10;

/* -------------------- Utils -------------------- */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nowStamp(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(
    d.getHours()
  )}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

async function ensureDir() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
}

async function readJson(file: string) {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

async function writeJsonAtomic(file: string, data: any) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/* -------------------- Types -------------------- */

export type SnapshotInfo = {
  id: string;
  createdAt: string;
  sizeBytes: number;
};

/* -------------------- Listing -------------------- */

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  await ensureDir();

  const files = await fs.readdir(SNAPSHOT_DIR);
  const result: SnapshotInfo[] = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;

    const full = path.join(SNAPSHOT_DIR, f);
    const stat = await fs.stat(full);

    result.push({
      id: f,
      createdAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
    });
  }

  result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return result;
}

/* -------------------- Create Snapshot -------------------- */

export async function createSnapshotFromCurrentState(): Promise<SnapshotInfo | null> {
  await ensureDir();

  // products.json muss existieren
  try {
    await fs.access(PRODUCTS_FILE);
  } catch {
    return null;
  }

  const products = await readJson(PRODUCTS_FILE);
  const config = await getConfig();

  const stamp = nowStamp();
  const filename = `snapshot_${stamp}.json`;
  const target = path.join(SNAPSHOT_DIR, filename);

  const snapshot = {
    meta: {
      id: filename,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    },
    state: {
      products,
      config,
    },
  };

  await writeJsonAtomic(target, snapshot);
  await pruneSnapshotsKeepLatest(MAX_SNAPSHOTS);

  const stat = await fs.stat(target);
  return {
    id: filename,
    createdAt: snapshot.meta.createdAt,
    sizeBytes: stat.size,
  };
}

/* -------------------- Prune -------------------- */

export async function pruneSnapshotsKeepLatest(
  max: number = MAX_SNAPSHOTS
) {
  const all = await listSnapshots();
  const toDelete = all.slice(max);

  await Promise.all(
    toDelete.map((s) =>
      fs.unlink(path.join(SNAPSHOT_DIR, s.id)).catch(() => {})
    )
  );
}

/* -------------------- Restore -------------------- */

export async function restoreSnapshot(snapshotId: string): Promise<void> {
  await ensureDir();

  const file = path.join(SNAPSHOT_DIR, snapshotId);
  await fs.access(file);

  const snapshot = await readJson(file);

  if (!snapshot?.state?.products || !snapshot?.state?.config) {
    throw new Error("Invalid snapshot format");
  }

  // Produkte zurück
  await writeJsonAtomic(PRODUCTS_FILE, snapshot.state.products);

  // komplette Config zurück
  await saveConfig(snapshot.state.config);
}

export async function deleteSnapshot(snapshotId: string) {
  await ensureDir();
  const file = path.join(SNAPSHOT_DIR, snapshotId);
  await fs.access(file);
  await fs.unlink(file);
}

// app/lib/productsBackups.ts
import { promises as fs } from "fs";
import path from "path";
import { PRODUCTS_FILE } from "@/app/lib/productsStore";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "products-backups");
const MAX_BACKUPS = 10;

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nowStamp(d = new Date()) {
  // YYYYMMDD_HHMMSS
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export type BackupInfo = {
  id: string;           // filename
  createdAt: string;    // ISO
  sizeBytes: number;
};

export async function listBackups(): Promise<BackupInfo[]> {
  await ensureBackupDir();
  const files = await fs.readdir(BACKUP_DIR);
  const infos: BackupInfo[] = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const full = path.join(BACKUP_DIR, f);
    const stat = await fs.stat(full);

    // createdAt aus Filename extrahieren (products_YYYYMMDD_HHMMSS.json)
    const m = f.match(/^products_(\d{8})_(\d{6})\.json$/);
    let createdAtIso = stat.mtime.toISOString();
    if (m) {
      const [_, ymd, hms] = m;
      const yyyy = Number(ymd.slice(0, 4));
      const mm = Number(ymd.slice(4, 6));
      const dd = Number(ymd.slice(6, 8));
      const hh = Number(hms.slice(0, 2));
      const mi = Number(hms.slice(2, 4));
      const ss = Number(hms.slice(4, 6));
      const dt = new Date(yyyy, mm - 1, dd, hh, mi, ss);
      createdAtIso = dt.toISOString();
    }

    infos.push({
      id: f,
      createdAt: createdAtIso,
      sizeBytes: stat.size,
    });
  }

  // neueste zuerst
  infos.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return infos;
}

export async function createBackupFromCurrentProducts(): Promise<BackupInfo | null> {
  await ensureBackupDir();

  // Wenn products file nicht existiert => kein Backup nötig
  try {
    await fs.access(PRODUCTS_FILE);
  } catch {
    return null;
  }

  const stamp = nowStamp(new Date());
  const filename = `products_${stamp}.json`;
  const target = path.join(BACKUP_DIR, filename);

  await fs.copyFile(PRODUCTS_FILE, target);
  const stat = await fs.stat(target);

  return {
    id: filename,
    createdAt: new Date().toISOString(),
    sizeBytes: stat.size,
  };
}

export async function pruneBackupsKeepLatest(max = MAX_BACKUPS): Promise<void> {
  const backups = await listBackups();
  const toDelete = backups.slice(max);
  await Promise.all(
    toDelete.map((b) => fs.unlink(path.join(BACKUP_DIR, b.id)).catch(() => {}))
  );
}

export async function restoreBackupToProducts(backupId: string): Promise<void> {
  await ensureBackupDir();
  const src = path.join(BACKUP_DIR, backupId);

  // Backup muss existieren
  await fs.access(src);

  // Restore überschreibt products.json
  await fs.mkdir(path.dirname(PRODUCTS_FILE), { recursive: true });
  await fs.copyFile(src, PRODUCTS_FILE);
}

import fs from "fs/promises";
import path from "path";

/* -------------------------------------------------------
 * Speicherort bestimmen (Docker- oder Dev-Modus)
 * ----------------------------------------------------- */

const DATA_DIR =
  process.env.APP_DATA_DIR ||
  path.join(process.cwd(), "data"); // im Dev: ./data


async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}


/* -------------------------------------------------------
 * JSON lesen/schreiben
 * ----------------------------------------------------- */

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  await ensureDir();
  const filePath = path.join(DATA_DIR, fileName);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await writeJson(fileName, fallback);
    return fallback;
  }
}

async function writeJson<T>(fileName: string, data: T): Promise<void> {
  await ensureDir();
  const filePath = path.join(DATA_DIR, fileName);

  const unique =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  const tempPath = filePath + "." + unique + ".tmp";

  const raw = JSON.stringify(data, null, 2);

  await fs.writeFile(tempPath, raw, "utf8");

  // Windows-safe rename with retry + fallback
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fs.rename(tempPath, filePath);
      return; // success
    } catch (e: any) {
      const code = e?.code;

      // If target is locked (EPERM), wait and retry
      if (code === "EPERM" || code === "EBUSY") {
        await new Promise((r) => setTimeout(r, 50 * (i + 1)));
        continue;
      }

      // Anything else -> break to fallback below
      break;
    }
  }

  // Fallback: write directly to target, then cleanup temp
  await fs.writeFile(filePath, raw, "utf8").catch(() => {});
  await fs.unlink(tempPath).catch(() => {});
}



/* -------------------------------------------------------
 * AppConfig – endgültiges Schema
 * ----------------------------------------------------- */

export type AppConfig = {
  version: number;

  network: {
    deviceIpConfig: string;
    printerIp: string;
  };

  printer: {
    defaultCopies: number;
    labelTemplate: string;
    dpi: number;
    rotate: number;
  };

  ui: {
    language: string;
    theme: "light" | "dark";
  };

  sync: {
    xano: {
      enabled: boolean;
      baseUrl: string;
      apiKey: string;
      productsEndpoint: string;
      intervalMinutes: number;
      lastSyncAt: string | null;
      printerId: string;        // <-- EINZIGES Feld (auth token = printerId)
    };
  };
};


/* -------------------------------------------------------
 * Default Config – wird beim ersten Start erzeugt
 * ----------------------------------------------------- */

const DEFAULT_CONFIG: AppConfig = {
  version: 1,

  network: {
    deviceIpConfig: "",
    printerIp: ""
  },

  printer: {
    defaultCopies: 1,
    labelTemplate: "standard-v1",
    dpi: 203,
    rotate: 0
  },

  ui: {
    language: "de",
    theme: "light"
  },

  sync: {
    xano: {
      enabled: false,
      baseUrl: "",
      apiKey: "",
      productsEndpoint: "/products",
      intervalMinutes: 60,
      lastSyncAt: null,
      printerId: ""        // wichtig
    }
  }
};


/* -------------------------------------------------------
 * migrateConfig – ergänzt fehlende Felder automatisch
 * ----------------------------------------------------- */

function migrateConfig(raw: any): AppConfig {
  const cfg: AppConfig = {
    ...DEFAULT_CONFIG,
    ...raw,
    network: {
      ...DEFAULT_CONFIG.network,
      ...(raw.network || {})
    },
    printer: {
      ...DEFAULT_CONFIG.printer,
      ...(raw.printer || {})
    },
    ui: {
      ...DEFAULT_CONFIG.ui,
      ...(raw.ui || {})
    },
    sync: {
      xano: {
        ...DEFAULT_CONFIG.sync.xano,
        ...(raw.sync?.xano || {})
      }
    }
  };

  return cfg;
}


/* -------------------------------------------------------
 * Öffentliche Funktionen – Config
 * ----------------------------------------------------- */

export async function getConfig(): Promise<AppConfig> {
  const raw = await readJson("config.json", DEFAULT_CONFIG);
  const migrated = migrateConfig(raw);
  await writeJson("config.json", migrated);
  return migrated;
}

export async function saveConfig(next: AppConfig) {
  return writeJson("config.json", next);
}


/* -------------------------------------------------------
 * Produkte JSON
 * ----------------------------------------------------- */

export type ProductsFile<T> = {
  version: number;
  items: T[];
  meta: {
    source: "local" | "xano";
    lastUpdatedAt: string;
  };
};

export async function getProducts<T>(fallback: T[] = []) {
  const empty: ProductsFile<T> = {
    version: 1,
    items: fallback,
    meta: {
      source: "local",
      lastUpdatedAt: new Date().toISOString(),
    },
  };

  return readJson<ProductsFile<T>>("products.json", empty);
}

export async function saveProducts<T>(file: ProductsFile<T>) {
  return writeJson("products.json", file);
}


/* -------------------------------------------------------
 * Optional: Reset-Funktionen
 * ----------------------------------------------------- */

export async function resetConfig() {
  await writeJson("config.json", DEFAULT_CONFIG);
}

export async function resetProducts() {
  await writeJson("products.json", {
    version: 1,
    items: [],
    meta: {
      source: "local",
      lastUpdatedAt: new Date().toISOString()
    }
  });
}

// app/api/sync/xano-products/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";

import { getConfig, saveConfig } from "@/app/lib/storage";
import {
  createSnapshotFromCurrentState,
  pruneSnapshotsKeepLatest,
} from "@/app/lib/snapshots";
import {
  getProducts,
  saveProducts,
  type ProductsFile,
} from "@/app/lib/storage";

export const runtime = "nodejs";

// Falls du ein striktes Preset-Interface hast, hier ersetzen.
// Aktuell nehmen wir "any", damit Xano-Shape flexibel bleibt.
type Preset = any;

function stableStringify(value: any): string {
  // Stabiler JSON-String: sortiert Object-Keys rekursiv (damit Hash stabil bleibt)
  const seen = new WeakSet();

  const normalize = (v: any): any => {
    if (v === null || typeof v !== "object") return v;

    if (seen.has(v)) return v;
    seen.add(v);

    if (Array.isArray(v)) return v.map(normalize);

    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = normalize(v[k]);
    return out;
  };

  return JSON.stringify(normalize(value));
}

function computeHash(items: Preset[]): string {
  const s = stableStringify(items);
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST() {
  try {
    console.log("[/api/sync/xano-products] START");

    const config = await getConfig();
    const xano = config.sync?.xano;

    if (!xano?.enabled) {
      console.warn("[sync] Xano sync disabled");
      return new NextResponse("Xano sync disabled.", { status: 400 });
    }

    if (!xano.baseUrl) {
      return new NextResponse("Xano baseUrl missing.", { status: 400 });
    }

    const printerId = (xano.printerId || "").trim();
    if (!printerId) {
      return new NextResponse("printerId missing.", { status: 400 });
    }

    // URL bauen
    const base = xano.baseUrl.replace(/\/$/, "");
    const endpoint = (xano.productsEndpoint || "/products").trim();
    const url = `${base}${endpoint}?printerId=${encodeURIComponent(printerId)}`;

    console.log("[sync] Xano sync URL:", url);

    const res = await fetch(url, {
      headers: {
        ...(xano.apiKey ? { Authorization: `Bearer ${xano.apiKey}` } : {}),
        "x-printer-id": printerId,
      },
      cache: "no-store",
    });

    const rawText = await res.text();

    if (!res.ok) {
      console.error("[sync] Xano responded with error:", res.status, rawText);
      return new NextResponse(
        `Xano error ${res.status}: ${rawText.slice(0, 300)}`,
        { status: 500 }
      );
    }

    // JSON parsen
    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      console.error("[sync] JSON parse error:", rawText);
      return new NextResponse("Xano returned invalid JSON.", { status: 500 });
    }

    // Mehrere mögliche Datenformen unterstützen
    const items: Preset[] =
      Array.isArray(json)
        ? json
        : Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.data)
            ? json.data
            : null;

    if (!items) {
      console.error("[sync] Unexpected JSON shape:", json);
      return new NextResponse("Unexpected Xano response shape.", {
        status: 500,
      });
    }

    console.log("[sync] Received items:", items.length);

    // ---- Aktuellen Stand aus storage.ts laden (dein products.json Schema) ----
    const currentFile = await getProducts<Preset>([]);
    const currentItems = Array.isArray(currentFile?.items)
      ? currentFile.items
      : [];

    // ---- Change detection (Hash) ----
    const oldHash = computeHash(currentItems);
    const newHash = computeHash(items);
    const changed = oldHash !== newHash;

    const nowIso = new Date().toISOString();

    if (!changed) {
      // Nur Config-Zeitstempel aktualisieren
      await saveConfig({
        ...config,
        sync: {
          ...config.sync,
          xano: {
            ...config.sync.xano,
            lastSyncAt: nowIso,
            lastSyncChanged: false,
          },
        },
        products: {
          ...config.products,
          currentHash: oldHash,
          // falls vorher Restore aktiv war, bleibt das so, sonst null
          currentFromBackupId: config.products?.currentFromBackupId ?? null,
        },
      });

      console.log("[/api/sync/xano-products] DONE - no changes");
      return NextResponse.json({
        ok: true,
        changed: false,
        count: items.length,
        hash: newHash,
      });
    }

    // ---- Snapshot-Backup aktueller Stand (vor Überschreiben) ----
    // (enthält products + komplette config)
    const backup = await createSnapshotFromCurrentState();
    await pruneSnapshotsKeepLatest(10);

    // ---- Schreiben im storage.ts Format (ProductsFile) ----
    const nextFile: ProductsFile<Preset> = {
      version: currentFile?.version ?? 1,
      items,
      meta: {
        source: "xano",
        lastUpdatedAt: nowIso,
      },
    };

    await saveProducts(nextFile);

    // ---- Config aktualisieren ----
    await saveConfig({
      ...config,
      sync: {
        ...config.sync,
        xano: {
          ...config.sync.xano,
          lastSyncAt: nowIso,
          lastSyncChanged: true,
        },
      },
      products: {
        ...config.products,
        currentHash: newHash,
        currentFromBackupId: null, // nach Sync wieder "live"
        lastBackupId: backup?.id || null, // Feldname bleibt, ist jetzt Snapshot-ID
      },
    });

    console.log("[/api/sync/xano-products] DONE - stored:", items.length);

    return NextResponse.json({
      ok: true,
      changed: true,
      count: items.length,
      hash: newHash,
      backupCreated: backup?.id || null,
    });
  } catch (err: any) {
    console.error("[/api/sync/xano-products] FAILED:", err);
    return new NextResponse(
      `Sync failed: ${err?.message || "unknown error"}`,
      { status: 500 }
    );
  }
}

// app/api/sync/supabase-presets/route.ts

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

// Supabase payload types
type SupabaseProduct = {
  name: string;
  description: string | null;
  sku: string;
  weight_g: number;
  shelf_life_days: number;
  dietTypeSvg: string | null;
  ingredientsHtml: string; // Already formatted HTML
};

type SupabaseSlot = {
  position: number;
  product: SupabaseProduct;
};

type SupabasePreset = {
  preset: {
    id: string;
    name: string;
    active: boolean;
  };
  slots: SupabaseSlot[];
};

type SupabasePayload = {
  presets: SupabasePreset[];
};

// Transformed preset type for the app
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

/**
 * Transforms a Supabase product to the app's PrinterProduct format
 * Data is already properly formatted from the API, so we just map the fields
 */
function transformSupabaseProduct(
  supabaseProduct: SupabaseProduct | null,
  position: number
): any | null {
  // Skip null products
  if (!supabaseProduct) {
    console.warn(`[transform] Skipping null product at position ${position}`);
    return null;
  }

  // Validate required fields
  if (!supabaseProduct.sku) {
    console.warn(`[transform] Skipping product without SKU at position ${position}`, supabaseProduct);
    return null;
  }

  // Generate a numeric ID from SKU and position for consistency
  const generateId = (sku: string, pos: number): number => {
    let hash = 0;
    const str = `${sku}-${pos}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  const transformed = {
    id: generateId(supabaseProduct.sku, position),
    name: supabaseProduct.name || "Unbekannt",
    weight: supabaseProduct.weight_g || 0,
    art_number: supabaseProduct.sku,
    mhd: supabaseProduct.shelf_life_days || 0,
    description: supabaseProduct.description || undefined,
    dietTypeSvg: supabaseProduct.dietTypeSvg || undefined,
    // Store ingredientsHtml directly - already formatted
    ingredientsHtml: supabaseProduct.ingredientsHtml || "",
    // For compatibility with existing code
    printer_components_ids: [],
  };

  // Debug logging
  if (!transformed.ingredientsHtml) {
    console.warn(`[transform] No ingredientsHtml for product ${supabaseProduct.name} (SKU: ${supabaseProduct.sku})`);
  } else {
    console.log(`[transform] Stored ingredientsHtml for ${supabaseProduct.name}: ${transformed.ingredientsHtml.substring(0, 50)}...`);
  }

  return transformed;
}

/**
 * Transforms Supabase presets payload to app's preset format
 */
function transformSupabasePayload(payload: SupabasePayload): Preset[] {
  return payload.presets
    .filter((p) => p.preset.active !== false) // Only include active presets
    .map((supabasePreset) => {
      // Sort slots by position
      const sortedSlots = [...supabasePreset.slots].sort(
        (a, b) => a.position - b.position
      );

      // Transform products and extract IDs (filter out null products)
      const products = sortedSlots
        .map((slot) => transformSupabaseProduct(slot.product, slot.position))
        .filter((p): p is NonNullable<typeof p> => p !== null);
      const productIds = products.map((p) => p.id);

      // Skip presets without any valid products
      if (products.length === 0) {
        console.warn(`[transform] Skipping preset "${supabasePreset.preset.name}" - no valid products`);
        return null;
      }

      // Convert preset UUID to number
      const uuidToNumber = (uuid: string): number => {
        let hash = 0;
        for (let i = 0; i < uuid.length; i++) {
          const char = uuid.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return Math.abs(hash);
      };

      return {
        id: uuidToNumber(supabasePreset.preset.id),
        name: supabasePreset.preset.name,
        active: supabasePreset.preset.active,
        product_ids: productIds,
        products: products, // Store full product data
        slots: sortedSlots, // Keep original slot structure for reference
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null); // Filter out presets without products
}

export async function POST(req: Request) {
  try {
    console.log("[/api/sync/supabase-presets] START");

    // Parse request body to get optional preset name parameter
    let requestBody: { name?: string } = {};
    try {
      const bodyText = await req.text();
      if (bodyText && bodyText.trim()) {
        requestBody = JSON.parse(bodyText);
      }
    } catch {
      // If no body or invalid JSON, use defaults
    }

    // ---- Config laden ----
    const config = await getConfig();
    const supabase = config.sync?.supabase;

    if (!supabase?.enabled) {
      console.warn("[sync] Supabase sync disabled");
      return new NextResponse("Supabase sync disabled.", { status: 400 });
    }

    if (!supabase.endpointUrl) {
      return new NextResponse("Supabase endpointUrl missing.", { status: 400 });
    }

    if (!supabase.apiKey) {
      return new NextResponse("Supabase apiKey missing.", { status: 400 });
    }

    // Supabase configuration from config
    const supabaseUrl = supabase.endpointUrl.trim();
    const supabaseApiKey = supabase.apiKey.trim();
    const presetName = requestBody.name || "Functions";

    console.log("[sync] Supabase sync URL:", supabaseUrl);
    console.log("[sync] Preset name:", presetName);
    console.log("[sync] API Key length:", supabaseApiKey.length);
    console.log("[sync] API Key prefix:", supabaseApiKey.substring(0, 20) + "...");

    const res = await fetch(supabaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseApiKey,
      },
      body: JSON.stringify({ name: presetName }),
      cache: "no-store",
    });

    const rawText = await res.text();

    if (!res.ok) {
      console.error("[sync] Supabase responded with error:", res.status, rawText);
      return new NextResponse(
        `Supabase error ${res.status}: ${rawText.slice(0, 300)}`,
        { status: 500 }
      );
    }

    // JSON parsen
    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      console.error("[sync] JSON parse error:", rawText);
      return new NextResponse("Supabase returned invalid JSON.", { status: 500 });
    }

    // Validate and transform Supabase payload
    if (!json || !Array.isArray(json.presets)) {
      console.error("[sync] Unexpected JSON shape:", json);
      return new NextResponse("Unexpected Supabase response shape.", {
        status: 500,
      });
    }

    const items: Preset[] = transformSupabasePayload(json as SupabasePayload);

    console.log("[sync] Received presets:", items.length);

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
          supabase: {
            ...config.sync.supabase,
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

      console.log("[/api/sync/supabase-presets] DONE - no changes");
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
        source: "supabase",
        lastUpdatedAt: nowIso,
      },
    };

    await saveProducts(nextFile);

    // ---- Config aktualisieren ----
    await saveConfig({
      ...config,
      sync: {
        ...config.sync,
        supabase: {
          ...config.sync.supabase,
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

    console.log("[/api/sync/supabase-presets] DONE - stored:", items.length);

    return NextResponse.json({
      ok: true,
      changed: true,
      count: items.length,
      hash: newHash,
      backupCreated: backup?.id || null,
    });
  } catch (err: any) {
    console.error("[/api/sync/supabase-presets] FAILED:", err);
    return new NextResponse(
      `Sync failed: ${err?.message || "unknown error"}`,
      { status: 500 }
    );
  }
}

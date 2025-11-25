import { redirect } from "next/navigation";
import { getConfig, getProducts } from "@/app/lib/storage";

export default async function LabelsRootPage() {
  // Config + Produkte (Presets) parallel laden
  const [config, productsFile] = await Promise.all([
    getConfig(),
    getProducts<any>(),
  ]);

  const items: any[] = productsFile.items || [];

  // Wenn gar keine Presets vorhanden sind:
  if (!items.length) {
    return (
      <div className="p-4">
        Keine Presets vorhanden. Bitte zuerst Presets/Produkte anlegen.
      </div>
    );
  }

  // Start-Preset aus Config
  const preferredId = config.ui.startPresetId;

  // prüfen, ob dieses Preset existiert
  const hasPreferred =
    preferredId &&
    items.some((p) => String(p.id) === String(preferredId));

  const targetId = hasPreferred
    ? String(preferredId)
    : String(items[0].id); // Fallback: erstes Preset

  // auf die dynamische Seite /labels/[presetId] umleiten
  redirect(`/labels/${targetId}`);
}

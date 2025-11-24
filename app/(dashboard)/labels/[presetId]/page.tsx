// app/(dashboard)/labels/[presetId]/page.tsx  (Server Component)
import { getProducts } from "@/app/components/sideNav";
import ButtonGrid from "@/app/components/ButtonGrid";

export default async function LabelsPresetPage({
  params,
}: {
  params: Promise<{ presetId: string }>;
}) {
  const { presetId } = await params;          // <-- WICHTIG in Next 16
  const presets = await getProducts();
  const presetIdNum = Number(presetId);

  const activePreset = presets.find((p) => p.id === presetIdNum);
  const buttons = activePreset?.product_ids ?? [];

  if (!activePreset) {
    return <div className="p-4">Preset nicht gefunden.</div>;
  }

  return (
    <div className="w-full">
      <ButtonGrid buttons={buttons} />
    </div>
  );
}

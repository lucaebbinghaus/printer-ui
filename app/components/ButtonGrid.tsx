// components/ButtonGrid.tsx
"use client";

import { useEffect, useState } from "react";
import ButtonCard, { PrinterProduct } from "./ButtonCard";
import { usePrinterStatus } from "@/app/lib/usePrinterStatus";

function buildIngredientsHtml(product: PrinterProduct) {
  if (!Array.isArray(product.printer_components_ids)) return "";

  return product.printer_components_ids
    .map((c: any) => c?.html ?? "")
    .filter((s) => s.trim().length > 0)
    .join();
}

export default function ButtonGrid({ buttons }: { buttons: PrinterProduct[] }) {
  const { connected, isReady, isActive } = usePrinterStatus();

  // Welches Produkt wurde von *dieser* Session gestartet?
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);

  // Wenn der Drucker laut OPC-UA nicht mehr aktiv ist → Overlay entfernen
  useEffect(() => {
    if (!isActive) {
      setCurrentJobId(null);
    }
  }, [isActive]);

  async function handlePrint(product: PrinterProduct) {
    if (!connected) {
      alert("Der Drucker ist aktuell nicht verbunden.");
      return;
    }

    if (!isReady) {
      alert("Der Drucker ist nicht bereit (READY-Signal ist aus).");
      return;
    }

    if (isActive) {
      alert("Es läuft bereits ein Druckauftrag. Bitte warte, bis dieser fertig ist.");
      return;
    }

    // Diesen Job als „aktuellen“ markieren
    setCurrentJobId(product.id);

    const html = buildIngredientsHtml(product);
    console.log("INGREDIENTS HTML FRONTEND:", html);

    const weightWithG = `${Number(product.weight ?? 0)}g`;
    const mhdDays = Number(product.mhd ?? 0);
    const mhdDate = new Date(Date.now() + mhdDays * 86400000).toLocaleDateString(
      "de-DE"
    );

    await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        name: product.name,
        weight: weightWithG,
        art_number: product.art_number,
        mhd_days: mhdDays,
        mhd: mhdDate,
        description: product.description ?? "",
        dietTypeSvg: product?._addon_printer_product_diet_type?.svg ?? null,
      }),
    });
  }

  // Global: Ob überhaupt neue Jobs angenommen werden
  const printingBlocked = !connected || !isReady || isActive;

  return (
    <section className="mt-8 w-full max-w-7xl px-2 sm:px-4">
      <div
        className="
          grid
          grid-cols-2 sm:grid-cols-3 md:grid-cols-4
          gap-4
          justify-start
          items-start
          justify-items-start
        "
      >
        {buttons.map((b) => (
          <ButtonCard
            key={b.id}
            item={b}
            onClick={() => handlePrint(b)}
            disabled={printingBlocked}
            // Overlay NUR wenn:
            // - dieser Button das aktuelle Produkt ist
            // - und der Drucker laut OPC-UA wirklich aktiv ist
            isPrinting={currentJobId === b.id && isActive}
          />
        ))}
      </div>
    </section>
  );
}

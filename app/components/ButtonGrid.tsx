// components/ButtonGrid.tsx
"use client";

import { useEffect, useState } from "react";
import ButtonCard, { PrinterProduct } from "./ButtonCard";
import { usePrinterStatus } from "@/app/lib/usePrinterStatus";

export default function ButtonGrid({ buttons }: { buttons: PrinterProduct[] }) {
  const { connected, isReady, isActive } = usePrinterStatus();

  const [sendingJobId, setSendingJobId] = useState<number | null>(null);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setSendingJobId(null);
      setCurrentJobId(null);
    }
  }, [isActive]);

  async function handlePrint(product: PrinterProduct) {
    if (!connected) {
      alert("Der Drucker ist aktuell nicht verbunden.");
      return;
    }

    if (!isReady) {
      alert("Der Drucker ist nicht bereit. Bitte Status prüfen.");
      return;
    }

    if (isActive) {
      alert(
        "Es läuft bereits ein Druckauftrag. Bitte warte, bis dieser abgeschlossen ist."
      );
      return;
    }

    setSendingJobId(product.id);

    const weightWithG = `${Number(product.weight ?? 0)}g`;
    const mhdDays = Number(product.mhd ?? 0);
    const mhdDate = new Date(
      Date.now() + mhdDays * 86400000
    ).toLocaleDateString("de-DE");

    await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // html lassen wir leer – wird serverseitig berechnet
        html: "",
        name: product.name,
        weight: weightWithG,
        art_number: product.art_number,
        mhd_days: mhdDays,
        mhd: mhdDate,
        description: product.description ?? "",
        dietTypeSvg: (product as any).dietTypeSvg ?? (product as any)?._addon_printer_product_diet_type?.svg ?? null,
        // WICHTIG: gesamtes Produkt mitsenden, inkl. Komponenten & Ingredients
        product,
      }),
    });

    setCurrentJobId(product.id);
  }

  const printingBlocked =
    !connected || !isReady || isActive || sendingJobId !== null;

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
            isSending={sendingJobId === b.id && !isActive}
            isPrinting={currentJobId === b.id && isActive}
          />
        ))}
      </div>
    </section>
  );
}

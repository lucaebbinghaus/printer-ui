// components/ButtonGrid.tsx
"use client";

import ButtonCard, { PrinterProduct } from "./ButtonCard";

function buildIngredientsHtml(product: PrinterProduct) {
  if (!Array.isArray(product.printer_components_ids)) return "";

  return product.printer_components_ids
    .map((c: any) => c?.html ?? "")
    .filter((s) => s.trim().length > 0)
    .join();
}


export default function ButtonGrid({ buttons }: { buttons: PrinterProduct[] }) {

  async function handlePrint(product: PrinterProduct) {
    const html = buildIngredientsHtml(product);
    console.log("INGREDIENTS HTML FRONTEND:", html);

    const weightWithG = `${Number(product.weight ?? 0)}g`;
    const mhdDays = Number(product.mhd ?? 0);
    const mhdDate = new Date(Date.now() + mhdDays * 86400000)
      .toLocaleDateString("de-DE");

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
      })

    });
  }


  return (
    <section className=" mt-8 w-full max-w-7xl px-2 sm:px-4">
      <div
        className="
        grid
        grid-cols-2 sm:grid-cols-3 md:grid-cols-4
        gap-4
        justify-start        /* WICHTIG */
        items-start          /* optional */
        justify-items-start  /* WICHTIG */
      "
      >
        {buttons.map((b) => (
          <ButtonCard key={b.id} item={b} onClick={() => handlePrint(b)} />
        ))}
      </div>
    </section>
  );
}

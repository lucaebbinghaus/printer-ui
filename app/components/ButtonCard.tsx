// components/ButtonCard.tsx
export type PrinterIngredient = { name: string; html: string; };
export type PrinterComponent = { name: string; printer_ingredients_ids: PrinterIngredient[]; };
export type PrinterProduct = {
  id: number;
  created_at: number;
  name: string;
  printer_components_ids: PrinterComponent[];
  weight: number;
  art_number: string;
  mhd: number;
};

export default function ButtonCard({
  item,
  onClick,
}: {
  item: PrinterProduct;
  onClick?: () => void;
}) {
  const createdDate = new Date(item.created_at).toLocaleDateString("de-DE");

  return (
    <button
      onClick={onClick}
      className="
        flex
        group relative h-44 w-full rounded-xl border border-gray-200 bg-white
        p-4 text-left shadow-sm
        hover:border-gray-300 hover:shadow-md
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10
        active:scale-[0.985] transition
      "
    >
      {/* Title */}
      <div className="text-sm font-semibold text-gray-900 line-clamp-2">
        {item.name}
      </div>


      {/* Bottom row */}
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
        <div className="text-sm font-medium text-gray-700">
          {(item.weight ?? 0)}g
        </div>

        <div className="text-right leading-tight">
          <div className="text-xs font-semibold text-gray-900">
            {createdDate}
          </div>
          {item.art_number && (
            <div className="text-xs text-gray-600">
              {item.art_number}
            </div>
          )}
        </div>
      </div>

      {/* subtle hover highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-b from-gray-50/40 to-transparent" />
    </button>
  );
}

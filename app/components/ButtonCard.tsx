// components/ButtonCard.tsx

export type PrinterIngredient = {
  name: string;
  html: string;
};

export type PrinterComponent = {
  name: string;
  printer_ingredients_ids: PrinterIngredient[];
};

export type PrinterProduct = {
  id: number;
  created_at: number;
  name: string;
  printer_components_ids: PrinterComponent[];
  weight: number;
  art_number: string;
  mhd: number;
  description?: string;
  _addon_printer_product_diet_type?: {
    name: string;
    svg: string;
  };
};

type ButtonCardProps = {
  item: PrinterProduct;
  onClick?: () => void;
  disabled?: boolean;
  isPrinting?: boolean;
};

export default function ButtonCard({
  item,
  onClick,
  disabled = false,
  isPrinting = false,
}: ButtonCardProps) {
  const createdDate = new Date(item.created_at).toLocaleDateString("de-DE");

  const baseClasses = `
    flex
    group relative h-44 w-full rounded-xl border bg-white
    p-4 text-left shadow-sm
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10
    active:scale-[0.985] transition
  `;

  const enabledStyles = `
    border-gray-200
    hover:border-gray-300 hover:shadow-md
  `;

  const disabledStyles = `
    border-gray-200
    opacity-60 cursor-not-allowed
  `;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[baseClasses, disabled ? disabledStyles : enabledStyles].join(
        " "
      )}
    >
      {/* Produktname */}
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
            <div className="text-xs text-gray-600">{item.art_number}</div>
          )}
        </div>
      </div>

      {/* Hover highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-b from-gray-50/40 to-transparent" />

      {/* Overlay bei aktivem Job */}
      {isPrinting && (
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 border border-blue-200 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Druckauftrag läuft …</span>
          </div>
        </div>
      )}
    </button>
  );
}

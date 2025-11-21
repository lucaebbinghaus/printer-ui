// components/TopBar.tsx
import { RotateCcw, SlidersHorizontal } from "lucide-react";

export default function TopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 w-full bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Left */}
        <div className="text-sm font-semibold text-gray-900">
          {title}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Status pill */}
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Status
          </div>

          {/* Icon buttons */}
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition"
            aria-label="Settings"
          >
            <SlidersHorizontal size={16} />
          </button>

          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition"
            aria-label="Refresh"
          >
            <RotateCcw size={16} />
          </button>

          {/* Reload button */}
          <button className="h-9 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 shadow-sm hover:bg-gray-50 active:scale-95 transition">
            Neu Laden
          </button>
        </div>
      </div>
      <div className="border-b border-gray-200" />
    </header>
  );
}

"use client";

import { useKeyboard } from "../KeyboardProvider";

const rows: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["←", "0", "OK"],
];

export default function NumericKeyboard() {
  const { insertText, backspace, close, target } = useKeyboard();

  function press(k: string) {
    if (!target) return;

    if (k === "←") backspace();
    else if (k === "OK") {
      target.blur();
      close();
    } else insertText(k);
  }

  return (
    <div className="kb-wrap">
      {rows.map((r, i) => (
        <div className="kb-row" key={i}>
          {r.map((k) => (
            <button
              key={k}
              type="button"
              className={`kb-btn ${k === "OK" ? "kb-primary" : ""}`}
              onMouseDown={(e) => e.preventDefault()} // keeps input focus
              onClick={() => press(k)}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

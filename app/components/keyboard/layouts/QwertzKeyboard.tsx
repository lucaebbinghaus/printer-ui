"use client";

import { useState } from "react";
import { useKeyboard } from "../KeyboardProvider";

/**
 * Normalisiertes deutsches QWERTZ Layout:
 * - ABC Ebene (mit Umlauten + ß)
 * - SHIFT Ebene (Groß + Zeichen)
 * - SYM Ebene 1/2
 * - Bearbeitung erfolgt über Provider (insertText/backspace/etc.)
 */

const ABC_DEFAULT: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "ß", "←"],
  ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ü"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ö", "ä"],
  ["SHIFT", "y", "x", "c", "v", "b", "n", "m", ",", ".", "-", "ENTER"],
  ["SYM", "SPACE", "OK"],
];

const ABC_SHIFT: string[][] = [
  ["!", "\"", "§", "$", "%", "&", "/", "(", ")", "=", "?", "←"],
  ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P", "Ü"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ö", "Ä"],
  ["SHIFT", "Y", "X", "C", "V", "B", "N", "M", ";", ":", "_", "ENTER"],
  ["SYM", "SPACE", "OK"],
];

const SYM_1: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "@", "←"],
  ["#", "€", "%", "&", "*", "+", "-", "/", "=", "(", ")"],
  ["!", "?", "\"", "'", ":", ";", "_", "~", "^", "°"],
  ["SYM2", ",", ".", "<", ">", "{", "}", "[", "]", "ENTER"],
  ["ABC", "SPACE", "OK"],
];

const SYM_2: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "\\", "←"],
  ["|", "`", "´", "¨", "…", "·", "•", "£", "$", "¥", "¢"],
  ["✔", "✖", "★", "☆", "→", "←", "↑", "↓", "±", "×"],
  ["SYM1", ",", ".", "<", ">", "(", ")", "[", "]", "ENTER"],
  ["ABC", "SPACE", "OK"],
];

function isControl(k: string) {
  return (
    k === "SHIFT" ||
    k === "SYM" ||
    k === "SYM1" ||
    k === "SYM2" ||
    k === "ABC" ||
    k === "←" ||
    k === "SPACE" ||
    k === "ENTER" ||
    k === "OK"
  );
}

export default function QwertzKeyboard() {
  const {
    shift,
    caps,
    symbols,
    setShift,
    toggleSymbols,
    insertText,
    backspace,
    space,
    enter,
    moveLeft,
    moveRight,
    close,
    target,
  } = useKeyboard();

  const [symLevel, setSymLevel] = useState<1 | 2>(1);

  function pressKey(k: string) {
    if (!target) return;

    if (k === "←") return backspace();
    if (k === "SPACE") return space();
    if (k === "ENTER") return enter();
    if (k === "OK") {
      target.blur();
      close();
      return;
    }

    if (k === "SHIFT") {
      if (!symbols) setShift(!shift);
      return;
    }

    if (k === "SYM") {
      setSymLevel(1);
      if (!symbols) toggleSymbols();
      return;
    }

    if (k === "ABC") {
      setSymLevel(1);
      if (symbols) toggleSymbols();
      return;
    }

    if (k === "SYM1") {
      setSymLevel(1);
      return;
    }

    if (k === "SYM2") {
      setSymLevel(2);
      return;
    }

    // extra: Pfeile (optional) – falls du sie später einbaust
    if (k === "◀") return moveLeft();
    if (k === "▶") return moveRight();

    // normale Zeichen
    insertText(k);
  }

  // Layout wählen
  let layout: string[][];

  if (symbols) {
    layout = symLevel === 1 ? SYM_1 : SYM_2;
  } else {
    // caps/shift interplay:
    // caps = sticky uppercase, shift toggles momentary relative to caps
    const upper = caps ? !shift : shift;
    layout = upper ? ABC_SHIFT : ABC_DEFAULT;
  }

  return (
    <div className="kb-wrap">
      {layout.map((row, idx) => (
        <div className="kb-row" key={idx}>
          {row.map((k) => {
            const wide =
              k === "SPACE"
                ? "kb-wide-space"
                : k === "ENTER"
                ? "kb-wide-enter"
                : k === "SHIFT"
                ? "kb-wide-shift"
                : k === "OK"
                ? "kb-wide-ok"
                : "";

            const active =
              (!symbols && k === "SHIFT" && shift) ||
              (symbols && k === "SYM1" && symLevel === 1) ||
              (symbols && k === "SYM2" && symLevel === 2);

            return (
              <button
                key={`${idx}-${k}`}
                type="button"
                className={[
                  "kb-btn",
                  wide,
                  active ? "kb-active" : "",
                  k === "OK" ? "kb-primary" : "",
                ].join(" ")}
                onMouseDown={(e) => e.preventDefault()} // Fokus im Input halten
                onClick={() => pressKey(k)}
              >
                {k === "SPACE" ? "Space" : k}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useKeyboard } from "./KeyboardProvider";
import NumericKeyboard from "./layouts/NumericKeyboard";
import QwertzKeyboard from "./layouts/QwertzKeyboard";
import "./keyboard.css";

export default function KeyboardOverlay() {
  const { mode } = useKeyboard();
  if (!mode) return null;

  return (
    <div className="keyboard-overlay" role="dialog" aria-label="On-screen keyboard">
      {mode === "numeric" ? <NumericKeyboard /> : <QwertzKeyboard />}
    </div>
  );
}

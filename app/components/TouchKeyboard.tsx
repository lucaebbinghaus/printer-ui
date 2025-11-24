"use client";

import React, { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "simple-keyboard/build/css/index.css";

// Keyboard-Dynamik: wichtig, sonst SSR-Fehler
const Keyboard = dynamic(() => import("react-simple-keyboard").then(m => m.default), {
  ssr: false,
});

type TouchKeyboardProps = {
  value: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
};

export default function TouchKeyboard({ value, onChange, onEnter }: TouchKeyboardProps) {
  const keyboardRef = useRef<any>(null);
  const [layoutName, setLayoutName] = useState<"default" | "shift">("default");

  const layout = useMemo(() => ({
    default: [
      "^ 1 2 3 4 5 6 7 8 9 0 ß ´ {bksp}",
      "q w e r t z u i o p ü +",
      "a s d f g h j k l ö ä #",
      "{shift} < y x c v b n m , . - {shift}",
      "{space} {enter}",
    ],
    shift: [
      "° ! \" § $ % & / ( ) = ? ` {bksp}",
      "Q W E R T Z U I O P Ü *",
      "A S D F G H J K L Ö Ä '",
      "{shift} > Y X C V B N M ; : _ {shift}",
      "{space} {enter}",
    ],
  }), []);

  const display = {
    "{bksp}": "⌫",
    "{enter}": "⏎",
    "{shift}": "⇧",
    "{space}": "Leertaste",
  };

  const handleKeyPress = (button: string) => {
    if (button === "{shift}") {
      setLayoutName(prev => (prev === "default" ? "shift" : "default"));
    }
    if (button === "{enter}") onEnter?.();
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl shadow-lg p-2 bg-white">
      <Keyboard
        keyboardRef={r => (keyboardRef.current = r)}
        layout={layout}
        layoutName={layoutName}
        display={display}
        onChange={(input: string) => onChange(input)}
        onKeyPress={handleKeyPress}
        theme={"hg-theme-default hg-layout-default myTheme"}
      />

      <style jsx global>{`
        .myTheme .hg-button {
          height: 52px;
          font-size: 18px;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "simple-keyboard/build/css/index.css";

const Keyboard = dynamic(() => import("react-simple-keyboard").then(m => m.default), {
  ssr: false,
});

type TouchKeyboardProps = {
  value: string;
  onKeyPress: (button: string) => void;
  onEnter?: () => void;
};

export default function TouchKeyboard({ value, onKeyPress, onEnter }: TouchKeyboardProps) {
  const keyboardRef = useRef<any>(null);
  const [layoutName, setLayoutName] = useState<"default" | "shift">("default");

  const layout = useMemo(
    () => ({
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
    }),
    []
  );

  const display = {
    "{bksp}": "⌫",
    "{enter}": "⏎",
    "{shift}": "⇧",
    "{space}": "Leertaste",
  };

  // Sync Keyboard-Display mit externem Value
  useEffect(() => {
    if (keyboardRef.current) {
      keyboardRef.current.setInput(value ?? "");
    }
  }, [value]);

  const handleKeyPress = (button: string) => {
    if (button === "{shift}") {
      setLayoutName(prev => (prev === "default" ? "shift" : "default"));
      return;
    }
    if (button === "{enter}") {
      onEnter?.();
      return;
    }
    onKeyPress(button);
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl shadow-lg p-2 bg-white">
      <Keyboard
        keyboardRef={r => (keyboardRef.current = r)}
        layout={layout}
        layoutName={layoutName}
        display={display}
        onKeyPress={handleKeyPress}
        // wir ignorieren onChange, weil wir selbst iPhone-like editieren
        onChange={() => {}}
        theme={"hg-theme-default hg-layout-default myTheme"}
          // WICHTIG: verhindert Fokus-Klau durch die Tastatur
        preventMouseDownDefault={true}
        stopMouseDownPropagation={true}
      />

      <style jsx global>{`
        .myTheme .hg-button {
          height: 52px;
          font-size: 18px;
          border-radius: 10px;
        }
        .myTheme .hg-button.hg-functionBtn {
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
}

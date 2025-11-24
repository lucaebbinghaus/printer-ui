"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import TouchKeyboard from "@/app/components/TouchKeyboard";

type ActiveInput = {
  getValue: () => string;
  setValue: (v: string) => void;
  ref?: React.RefObject<HTMLInputElement | null>;
};

type KeyboardCtx = {
  openFor: (input: ActiveInput) => void;
  close: () => void;
  isOpen: boolean;
};

const Ctx = createContext<KeyboardCtx | null>(null);

export function useKeyboard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKeyboard must be used inside KeyboardProvider");
  return ctx;
}

function applyButtonAtCaret(
  button: string,
  current: string,
  start: number,
  end: number
) {
  const before = current.slice(0, start);
  const after = current.slice(end);

  // Backspace
  if (button === "{bksp}") {
    if (start !== end) {
      // delete selection
      return { next: before + after, caret: start };
    }
    if (start === 0) return { next: current, caret: 0 };
    return {
      next: current.slice(0, start - 1) + current.slice(end),
      caret: start - 1,
    };
  }

  // Space
  if (button === "{space}") {
    const next = before + " " + after;
    return { next, caret: start + 1 };
  }

  // Ignore other function keys here (shift/enter werden im Keyboard selbst gehandhabt)
  if (button.startsWith("{") && button.endsWith("}")) {
    return { next: current, caret: start };
  }

  // Normal character
  const next = before + button + after;
  return { next, caret: start + button.length };
}

export default function KeyboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<ActiveInput | null>(null);
  const [value, setValue] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const openFor = (input: ActiveInput) => {
    setActiveInput(input);
    const v = input.getValue() ?? "";
    setValue(v);
    setIsOpen(true);

    // Fokus sofort sicherstellen
    input.ref?.current?.focus();
  };

  const close = () => {
    setIsOpen(false);
    setActiveInput(null);
  };

  // Tap außerhalb => schließen (Keyboard + Input zählen als "innen")
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const kb = overlayRef.current;
      if (!kb) return;

      if (!kb.contains(e.target as Node)) {
        close();
        activeInput?.ref?.current?.blur();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen, activeInput]);

  const ctxValue = useMemo(() => ({ openFor, close, isOpen }), [isOpen]);

  return (
    <Ctx.Provider value={ctxValue}>
      {children}

      {isOpen &&
        createPortal(
          <div
            ref={overlayRef}
            className="fixed inset-x-0 bottom-0 z-[9999] bg-white border-t border-gray-200 shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            // wichtig: Klicks auf dem Keyboard dürfen NICHT als outside click gelten
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TouchKeyboard
              value={value}
              onKeyPress={(button) => {
                const inputEl = activeInput?.ref?.current;
                if (!inputEl || !activeInput) return;

                // Cursor/Selection VOR dem Update holen
                const start = inputEl.selectionStart ?? value.length;
                const end = inputEl.selectionEnd ?? value.length;

                const { next, caret } = applyButtonAtCaret(
                  button,
                  value,
                  start,
                  end
                );

                // State + echtes Input-Value setzen
                setValue(next);
                activeInput.setValue(next);

                // Fokus + Cursor NACH dem Render stabil halten
                requestAnimationFrame(() => {
                  inputEl.focus();
                  inputEl.setSelectionRange(caret, caret);
                });
              }}
              onEnter={() => {
                close();
                activeInput?.ref?.current?.blur();
              }}
            />
          </div>,
          document.body
        )}
    </Ctx.Provider>
  );
}

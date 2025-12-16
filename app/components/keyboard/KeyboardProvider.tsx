"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Mode = "numeric" | "text" | null;
type TargetEl = HTMLInputElement | HTMLTextAreaElement;

type KeyboardCtx = {
  mode: Mode;
  target: TargetEl | null;

  shift: boolean; // momentary
  caps: boolean; // sticky
  symbols: boolean;

  close: () => void;
  setShift: (v: boolean) => void;
  toggleCaps: () => void;
  toggleSymbols: () => void;

  insertText: (text: string) => void;
  backspace: () => void;
  enter: () => void;
  space: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  clear: () => void;
};

const Ctx = createContext<KeyboardCtx | null>(null);

export function useKeyboard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKeyboard must be used within KeyboardProvider");
  return ctx;
}

function isEditable(el: any): el is TargetEl {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function getMode(el: TargetEl): Mode {
  if (el instanceof HTMLInputElement && el.type === "number") return "numeric";
  return "text";
}

function scrollIntoViewCentered(el: HTMLElement) {
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  } catch {
    // ignore
  }
}

function getSelection(el: TargetEl) {
  const start = typeof el.selectionStart === "number" ? el.selectionStart : el.value.length;
  const end = typeof el.selectionEnd === "number" ? el.selectionEnd : el.value.length;
  return { start, end };
}

function setCaret(el: TargetEl, pos: number) {
  try {
    el.setSelectionRange(pos, pos);
  } catch {
    // ignore (some input types)
  }
}

/**
 * WICHTIG für kontrollierte React-Inputs:
 * Nicht "el.value = ..." direkt setzen, sondern den nativen Setter aufrufen.
 * Sonst merkt React den Change oft nicht zuverlässig.
 */
function setNativeValue(el: TargetEl, value: string) {
  const proto =
    el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;

  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc?.set) {
    desc.set.call(el, value);
  } else {
    // Fallback (sollte selten nötig sein)
    (el as any).value = value;
  }
}

/**
 * Echte Input/Change Events dispatchen, damit React/Form-Libs übernehmen.
 */
function emitInput(el: TargetEl) {
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  } catch {
    // Fallback für Umgebungen ohne InputEvent
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [mode, setModeState] = useState<Mode>(null);
  const [target, setTarget] = useState<TargetEl | null>(null);

  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);
  const [symbols, setSymbols] = useState(false);

  const close = () => {
    setModeState(null);
    setTarget(null);
    setShift(false);
    setCaps(false);
    setSymbols(false);
  };

  // Keyboard bei Navigation schließen
  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Fokus/Target Tracking
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const el = e.target as any;
      if (!isEditable(el)) return;

      setTarget(el);
      setModeState(getMode(el));

      setTimeout(() => scrollIntoViewCentered(el), 80);
    }

    function onFocusOut() {
      // nicht sofort schließen (Klick im Keyboard)
      setTimeout(() => {
        const ae = document.activeElement as any;
        if (!isEditable(ae)) {
          close();
        }
      }, 200);
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function insertText(text: string) {
    if (!target) return;

    target.focus();

    const { start, end } = getSelection(target);
    const value = target.value ?? "";

    const next = value.slice(0, start) + text + value.slice(end);

    setNativeValue(target, next);
    const newPos = start + text.length;
    setCaret(target, newPos);
    emitInput(target);

    // momentary shift resets after one key
    if (shift) setShift(false);
  }

  function backspace() {
    if (!target) return;

    target.focus();

    const { start, end } = getSelection(target);
    const value = target.value ?? "";

    // selection löschen
    if (start !== end) {
      const next = value.slice(0, start) + value.slice(end);
      setNativeValue(target, next);
      setCaret(target, start);
      emitInput(target);
      return;
    }

    // char links löschen
    if (start <= 0) return;

    const next = value.slice(0, start - 1) + value.slice(end);
    setNativeValue(target, next);
    setCaret(target, start - 1);
    emitInput(target);
  }

  function clear() {
    if (!target) return;
    target.focus();
    setNativeValue(target, "");
    setCaret(target, 0);
    emitInput(target);
  }

  function moveLeft() {
    if (!target) return;
    target.focus();
    const { start } = getSelection(target);
    setCaret(target, Math.max(0, start - 1));
  }

  function moveRight() {
    if (!target) return;
    target.focus();
    const { start } = getSelection(target);
    setCaret(target, Math.min((target.value ?? "").length, start + 1));
  }

  function space() {
    insertText(" ");
  }

  function enter() {
    if (!target) return;
    if (target instanceof HTMLTextAreaElement) {
      insertText("\n");
    } else {
      target.blur();
      close();
    }
  }

  function toggleCaps() {
    setCaps((v) => !v);
  }

  function toggleSymbols() {
    setSymbols((v) => !v);
    setShift(false);
  }

  const ctxValue = useMemo<KeyboardCtx>(
    () => ({
      mode,
      target,
      shift,
      caps,
      symbols,
      close,
      setShift,
      toggleCaps,
      toggleSymbols,
      insertText,
      backspace,
      enter,
      space,
      moveLeft,
      moveRight,
      clear,
    }),
    [mode, target, shift, caps, symbols]
  );

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

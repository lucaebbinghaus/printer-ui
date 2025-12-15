"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    osk?: {
      show: () => Promise<void>;
      hide: () => Promise<void>;
    };
  }
}

function isTextInput(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;

  if (tag === "input") {
    const t = (el.getAttribute("type") || "text").toLowerCase();
    // nur bei Eingabetypen, wo OSK Sinn macht
    return ["text", "number", "password", "email", "search", "tel", "url"].includes(t);
  }

  // contenteditable
  if (el.isContentEditable) return true;

  return false;
}

export default function OskFocusBridge() {
  useEffect(() => {
    let hideTimer: number | null = null;

    const onFocusIn = (e: FocusEvent) => {
      if (!window.osk?.show) return;
      if (isTextInput(e.target)) {
        if (hideTimer) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
        window.osk.show();
      }
    };

    const onFocusOut = () => {
      if (!window.osk?.hide) return;

      // kleines Delay, damit Wechsel zwischen Inputs nicht flackert
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        const active = document.activeElement;
        if (!isTextInput(active)) {
          window.osk?.hide();
        }
      }, 150);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  return null;
}

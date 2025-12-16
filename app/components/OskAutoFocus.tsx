"use client";

import { useEffect } from "react";

export default function OskAutoFocus() {
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement;
      if (!el) return;

      if (el.tagName === "INPUT") {
        const input = el as HTMLInputElement;
        const type = input.type;

        if (type === "number") {
          window.electronAPI?.oskShow?.("numeric");
        } else {
          window.electronAPI?.oskShow?.("text");
        }
        return;
      }

      if (el.tagName === "TEXTAREA" || el.getAttribute("contenteditable") === "true") {
        window.electronAPI?.oskShow?.("text");
      }
    }

    function onFocusOut() {
      // kleine Verzögerung verhindert Flackern
      setTimeout(() => {
        window.electronAPI?.oskHide?.();
      }, 150);
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

function isTextTarget(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") return true;
  if ((el as HTMLElement).getAttribute?.("contenteditable") === "true") return true;
  return false;
}

function getModeFor(el: HTMLElement): "numeric" | "text" {
  if (el.tagName === "INPUT") {
    const t = (el as HTMLInputElement).type;
    return t === "number" ? "numeric" : "text";
  }
  return "text";
}

export default function OskAutoFocus() {
  useEffect(() => {
    let hideTimer: any = null;

    function showForActiveElement() {
      const ae = document.activeElement as HTMLElement | null;
      if (!ae || !isTextTarget(ae)) return;
      window.electronAPI?.oskShow?.(getModeFor(ae));
    }

    function scheduleHideIfNoInputFocused() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        const ae = document.activeElement as HTMLElement | null;
        // Wenn gerade kein Input/Textarea fokussiert ist, dann schließen
        if (!ae || !isTextTarget(ae)) {
          window.electronAPI?.oskHide?.();
        }
      }, 250);
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (isTextTarget(target)) {
        window.electronAPI?.oskShow?.(getModeFor(target));
      } else {
        // Fokus auf etwas anderes -> ggf. schließen (aber delayed)
        scheduleHideIfNoInputFocused();
      }
    }

    // Wichtig: NICHT sofort bei focusout schließen (sonst klappt Onboard nie)
    function onFocusOut() {
      scheduleHideIfNoInputFocused();
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    // Falls beim Laden schon ein Input fokussiert ist
    setTimeout(showForActiveElement, 0);

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}

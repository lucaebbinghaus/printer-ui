// app/components/VisibilityHandler.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Überwacht die Visibility API und stellt sicher, dass die App
 * wieder funktioniert, wenn der Benutzer zurückkommt.
 * 
 * Dies verhindert Whitescreen-Probleme nach längerer Inaktivität.
 */
export default function VisibilityHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Wenn die Seite wieder sichtbar wird, refreshe die Route
      // um sicherzustellen, dass alle Komponenten wieder funktionieren
      if (!document.hidden) {
        // Kleine Verzögerung, damit der Browser Zeit hat, die Verbindungen wiederherzustellen
        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    };

    // Event Listener hinzufügen
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Auch auf Focus-Event hören (falls Visibility API nicht funktioniert)
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [router]);

  return null;
}


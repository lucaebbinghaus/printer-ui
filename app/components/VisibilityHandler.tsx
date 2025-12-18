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
    let refreshTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastHiddenAt: number | null = null;
    const MIN_HIDDEN_TIME = 5 * 60 * 1000; // 5 Minuten
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Seite wurde versteckt - Zeitstempel speichern
        lastHiddenAt = Date.now();
      } else if (lastHiddenAt !== null) {
        // Seite wurde wieder sichtbar - prüfe ob lange genug versteckt war
        const hiddenDuration = Date.now() - lastHiddenAt;
        
        // Nur refreshen wenn die Seite länger als MIN_HIDDEN_TIME versteckt war
        if (hiddenDuration >= MIN_HIDDEN_TIME) {
          // Cleanup previous timeout
          if (refreshTimeoutId) {
            clearTimeout(refreshTimeoutId);
            refreshTimeoutId = null;
          }
          
          // Kleine Verzögerung, damit der Browser Zeit hat, die Verbindungen wiederherzustellen
          refreshTimeoutId = setTimeout(() => {
            router.refresh();
          }, 1000);
        }
        
        lastHiddenAt = null;
      }
    };

    // Event Listener hinzufügen
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Auch auf Focus-Event hören (falls Visibility API nicht funktioniert)
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [router]);

  return null;
}


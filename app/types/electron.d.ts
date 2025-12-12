export {};

declare global {
  interface Window {
    electronAPI?: {
      /**
       * Toggle zwischen Vollbild und Fenster
       */
      toggleFullscreen?: () => Promise<void> | void;

      /**
       * Aktuellen Fullscreen-Status abfragen
       */
      getFullscreenState?: () => Promise<boolean>;

      /**
       * Host-System herunterfahren
       */
      shutdownHost?: () => Promise<void> | void;
    };
  }
}

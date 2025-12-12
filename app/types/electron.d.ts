export {};

declare global {
  interface Window {
    electronAPI?: {
      toggleResize?: () => Promise<void> | void;
      getFullscreenState?: () => Promise<boolean>;
      shutdownHost?: () => Promise<void> | void;
    };
  }
}

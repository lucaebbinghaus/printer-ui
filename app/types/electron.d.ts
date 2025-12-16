// app/types/electron.d.ts
export {};

declare global {
  interface Window {
    electronAPI?: {
      oskShow?: (mode: "numeric" | "text") => void | Promise<void>;
      oskHide?: () => void | Promise<void>;

      toggleResize?: () => void | Promise<void>;
      getFullscreenState?: () => Promise<boolean>;
      shutdownHost?: () => void | Promise<void>;
    };
  }
}

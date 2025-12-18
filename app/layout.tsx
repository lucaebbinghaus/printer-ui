// app/layout.tsx
import "./globals.css";
import TopBar from "./components/TopBar";
import LeftSidebar from "./components/LeftSidebar";
import SideNavRefreshOnRoute from "./components/SideNavRefreshOnRoute";

import { KeyboardProvider } from "./components/keyboard/KeyboardProvider";
import KeyboardOverlay from "./components/keyboard/KeyboardOverlay";

import UpdateGuard from "./components/UpdateGuard";
import VisibilityHandler from "./components/VisibilityHandler";
import ErrorBoundary from "./components/ErrorBoundary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased bg-gray-100 h-screen overflow-hidden">
        <SideNavRefreshOnRoute />
        <VisibilityHandler />

        <ErrorBoundary>
          <KeyboardProvider>
            {/* Globaler Update-Lock (friert die komplette App ein) */}
            <UpdateGuard />

            <div
              className="
                grid h-full
                grid-cols-[14rem_1fr]
                grid-rows-[3.5rem_1fr]
                relative z-0
              "
            >
              <div className="bg-[#efefef] border-b border-gray-200 border-r border-gray-200" />

              <div className="col-start-2 row-start-1 relative z-0">
                <TopBar />
              </div>

              <div className="col-start-1 row-start-2 border-r border-gray-200 bg-gray-100 overflow-auto relative z-0">
                <LeftSidebar />
              </div>

              <main className="col-start-2 row-start-2 overflow-auto p-4 relative z-0">
                {children}
              </main>
            </div>

            <KeyboardOverlay />
          </KeyboardProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

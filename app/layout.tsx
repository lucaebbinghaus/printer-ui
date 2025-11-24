import "./globals.css";
import TopBar from "./components/TopBar";
import LeftSidebar from "./components/LeftSidebar";
import KeyboardProvider from "./components/KeyboardProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased bg-gray-100 h-screen overflow-hidden">
        <KeyboardProvider>
          <div
            className="
              grid h-full
              grid-cols-[14rem_1fr]
              grid-rows-[3.5rem_1fr]
              relative z-0
            "
          >
            {/* Top-left empty spacer */}
            <div className="bg-[#efefef] border-b border-gray-200 border-r border-gray-200" />

            {/* Topbar top-right */}
            <div className="col-start-2 row-start-1 relative z-0">
              <TopBar />
            </div>

            {/* Sidebar bottom-left */}
            <div className="col-start-1 row-start-2 border-r border-gray-200 bg-gray-100 overflow-auto relative z-0">
              <LeftSidebar />
            </div>

            {/* Content bottom-right */}
            <main className="col-start-2 row-start-2 overflow-auto p-4 relative z-0">
              {children}
            </main>
          </div>
        </KeyboardProvider>
      </body>
    </html>
  );
}

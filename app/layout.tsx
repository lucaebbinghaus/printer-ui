import "./globals.css";
import TopBar from "./components/TopBar";
import LeftSidebar from "./components/LeftSidebar";


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased bg-gray-100 h-screen overflow-hidden">
        {/* 2x2 Grid: 
            col1 = Sidebar-Breite, col2 = Rest
            row1 = Topbar-Höhe, row2 = Rest */}
        <div
          className="
            grid h-full
            grid-cols-[14rem_1fr]   /* Sidebar 14rem, Rest flexibel */
            grid-rows-[3.5rem_1fr] /* Topbar 3.5rem (h-14), Rest flexibel */
          "
        >
          {/* Top-left empty spacer */}
          <div className="bg-[#efefef] border-b border-gray-200 border-r border-gray-200" />

          {/* Topbar top-right */}
          <div className="col-start-2 row-start-1">
            <TopBar />
          </div>

          {/* Sidebar bottom-left */}
          <div className="col-start-1 row-start-2 border-r border-gray-200 bg-gray-100 overflow-auto">
            <LeftSidebar />
          </div>

          {/* Content bottom-right */}
          <main className="col-start-2 row-start-2 overflow-auto p-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

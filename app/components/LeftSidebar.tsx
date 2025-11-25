// app/components/LeftSidebar.tsx (oder wo die Datei liegt)

// WICHTIG: verhindert, dass Next die Sidebar in Prod statisch/cached rendert
export const dynamic = "force-dynamic";
// alternativ oder zusätzlich möglich:
// export const revalidate = 0;

import { getSideNav } from "./sideNav";
import ClientLeftSidebar from "./ClientLeftSidebar";

export default async function LeftSidebar() {
  const sideNav = await getSideNav();
  return <ClientLeftSidebar sideNav={sideNav} />;
}

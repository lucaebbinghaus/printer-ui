// app/components/LeftSidebar.tsx (oder wo sie bei dir liegt)

// WICHTIG: erzwingt Node-Runtime (damit fs erlaubt ist)
export const runtime = "nodejs";
// WICHTIG: erzwingt, dass diese RSC immer dynamisch gerendert wird
export const dynamic = "force-dynamic";

import { getSideNav } from "./sideNav";
import ClientLeftSidebar from "./ClientLeftSidebar";

export default async function LeftSidebar() {
  const sideNav = await getSideNav();
  return <ClientLeftSidebar sideNav={sideNav} />;
}

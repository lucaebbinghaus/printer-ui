// app/components/LeftSidebar.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSideNav } from "./sideNav";
import ClientLeftSidebar from "./ClientLeftSidebar";

export default async function LeftSidebar() {
  console.log("[LeftSidebar] render");
  const sideNav = await getSideNav();
  return <ClientLeftSidebar sideNav={sideNav} />;
}

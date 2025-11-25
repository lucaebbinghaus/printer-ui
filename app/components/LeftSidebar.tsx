export const runtime = "nodejs";
export const dynamic = "force-dynamic"; 
export const fetchCache = "force-no-store"; 

import { getSideNav } from "./sideNav";
import ClientLeftSidebar from "./ClientLeftSidebar";

export default async function LeftSidebar() {
  const sideNav = await getSideNav();
  return <ClientLeftSidebar sideNav={sideNav} />;
}

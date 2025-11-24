import { getSideNav } from "./sideNav";
import ClientLeftSidebar from "./ClientLeftSidebar";

export default async function LeftSidebar() {
  const sideNav = await getSideNav();
  return <ClientLeftSidebar sideNav={sideNav} />;
}

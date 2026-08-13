/**
 * @file components/HQSidebarServer.tsx
 * @description Server-component wrapper around HQSidebar.
 * Fetches the open support ticket count and passes it as a prop so the
 * sidebar badge reflects live data on every HQ page load.
 *
 * Usage: replace `import HQSidebar from "@/components/HQSidebar"` with
 *        `import HQSidebarServer from "@/components/HQSidebarServer"`
 *        and render `<HQSidebarServer />` in place of `<HQSidebar />`.
 */
import HQSidebar from "@/components/HQSidebar";
import { getOpenSupportCount } from "@/lib/actions/support";

export default async function HQSidebarServer() {
  const openSupportCount = await getOpenSupportCount();
  return <HQSidebar openSupportCount={openSupportCount} />;
}

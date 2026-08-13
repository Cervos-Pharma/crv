/**
 * @file dashboard/layout.tsx
 * @description Server layout for the pharmacy dashboard. Guards suspended
 *   accounts at the layout level so every /dashboard/* page is covered.
 */
import { createClient } from "@/lib/supabase/server";
import SuspendedScreen from "@/components/SuspendedScreen";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: account } = await supabase
      .from("accounts")
      .select("suspended_at, suspension_reason")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (account?.suspended_at) {
      return <SuspendedScreen reason={account.suspension_reason} />;
    }
  }

  return <>{children}</>;
}

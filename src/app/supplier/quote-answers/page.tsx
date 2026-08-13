import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SupplierQuoteAnswersClient from "./SupplierQuoteAnswersClient";

export default async function SupplierQuoteAnswersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const accountType = user.user_metadata?.account_type ?? "pharmacy";
  if (accountType !== "supplier") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <main className="max-w-6xl mx-auto px-8 py-12">
        <SupplierQuoteAnswersClient />
      </main>
    </div>
  );
}

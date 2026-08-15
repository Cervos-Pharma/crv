import { getHQMessages } from "@/lib/actions/hq";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HQSidebarServer from "@/components/HQSidebarServer";
import HQMessagesClient from "./HQMessagesClient";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";

export default async function HQMessagesPage() {
  const cookieStore = await cookies();
  if (!isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value)) redirect("/hq");

  const { data: messages, error } = await getHQMessages();

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <HQSidebarServer />
      <main className="flex-1 ml-64 p-8 pt-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-1">
              HQ Console
            </p>
            <h1 className="font-headline-lg text-headline-lg text-ink-deep">Broadcast Messaging</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Push alerts and announcements to pharmacies and suppliers.
            </p>
          </div>

          {error ? (
            <div className="bg-error-container text-on-error-container p-6 rounded">
              <p className="font-body-md">Error loading messages: {error}</p>
            </div>
          ) : (
            <HQMessagesClient messages={messages ?? []} />
          )}
        </div>
      </main>
    </div>
  );
}

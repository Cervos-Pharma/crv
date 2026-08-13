import { getAllNewsPosts } from "@/lib/actions/hq";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HQSidebarServer from "@/components/HQSidebarServer";
import HQNewsClient from "./HQNewsClient";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";

export default async function HQNewsPage() {
  const cookieStore = await cookies();
  if (!isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value)) redirect("/hq");

  const { data: posts, error } = await getAllNewsPosts();

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <HQSidebarServer />
      <main className="flex-1 ml-64 p-8 pt-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-1">
              HQ Console
            </p>
            <h1 className="font-headline-lg text-headline-lg text-ink-deep">News Management</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Create and manage news articles for the public news page.
            </p>
          </div>

          {error ? (
            <div className="bg-error-container text-on-error-container p-6 rounded">
              <p className="font-body-md">Error loading posts: {error}</p>
            </div>
          ) : (
            <HQNewsClient posts={posts ?? []} />
          )}
        </div>
      </main>
    </div>
  );
}

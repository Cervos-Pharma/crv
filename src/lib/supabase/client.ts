/**
 * @file lib/supabase/client.ts
 * @description Browser-side Supabase client factory.
 *
 * Creates a client using the PUBLIC anon key — safe to expose in the browser.
 * All data access is gated by Supabase Row Level Security (RLS) policies,
 * which enforce that users can only read/write their own records.
 *
 * When `NEXT_PUBLIC_MOCK_MODE=true`, returns the in-memory mock client. In mock
 * mode the "signed-in" user is read from the `mock_user` cookie (`pharmacy`,
 * `supplier`, or `none`) so the UI stays consistent with the server-side role.
 *
 * Import pattern (in client components):
 * ```ts
 * import { createClient } from "@/lib/supabase/client";
 * const supabase = createClient();
 * ```
 *
 * @environment NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL
 * @environment NEXT_PUBLIC_SUPABASE_ANON_KEY  — Public anon/API key
 * @environment NEXT_PUBLIC_MOCK_MODE          — "true" to run on the in-memory mock backend
 */

import { createBrowserClient } from "@supabase/ssr";

import { createMockSupabase, mockUserForType } from "@/lib/mock/supabase";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

/** Type of the real browser client; the mock is cast to this so callers need no changes. */
type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

/**
 * Reads the mock role from the `mock_user` cookie set by the server (or the
 * role switcher). Runs only in the browser.
 */
function mockClient() {
  const readRole = (): "pharmacy" | "supplier" | "none" => {
    if (typeof document === "undefined") return "pharmacy";
    const value = document.cookie
      .split("; ")
      .find((c) => c.startsWith("mock_user="))
      ?.split("=")[1];
    if (value === "supplier") return "supplier";
    if (value === "none") return "none";
    return "pharmacy";
  };
  return createMockSupabase({
    resolveUser: () => {
      const role = readRole();
      return role === "none" ? null : mockUserForType(role);
    },
    onSignIn: (role) => {
      if (typeof document !== "undefined") {
        document.cookie = `mock_user=${role}; path=/; max-age=86400`;
      }
    },
    onSignOut: () => {
      if (typeof document !== "undefined") {
        document.cookie = "mock_user=none; path=/; max-age=3600";
      }
    },
  });
}

/**
 * Creates a Supabase client for use in browser (client) components.
 * Handles cookie-based session management automatically via `@supabase/ssr`.
 *
 * Call once per render — not a singleton; each call returns a fresh client
 * that reads the current cookie state from the browser.
 *
 * @returns Supabase browser client scoped to the anon role
 */
export function createClient(): SupabaseBrowserClient {
  if (IS_MOCK) return mockClient() as unknown as SupabaseBrowserClient;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

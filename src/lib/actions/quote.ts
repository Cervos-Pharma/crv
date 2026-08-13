/**
 * @file lib/actions/quote.ts
 * @description Server actions for supplier quote requests.
 *
 * The quote request flow is public — no auth required to submit. This enables
 * prospective suppliers to apply without first creating an account.
 *
 * Rate limiting is applied in-process (no Redis required) at 3 submissions
 * per hour per email address. This is sufficient to prevent casual abuse;
 * for production, consider moving to a durable store (Redis/Supabase table).
 *
 * Supabase tables touched:
 *   - quote_requests — insert (submitQuoteRequest), read (getMyQuoteRequest)
 *   - accounts       — read (getMyQuoteRequest, to find the supplier account)
 *
 * @environment NEXT_PUBLIC_SUPABASE_URL
 * @environment NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Validation constants ────────────────────────────────────────────────────

const LIMITS = {
  companyName:  { max: 200, label: "Company name" },
  contactName:  { max: 200, label: "Contact name" },
  email:        { max: 320, label: "Email" },
  phone:        { max: 30,  label: "Phone" },
  message:      { max: 2000, label: "Message" },
} as const;

/** Simple email format check — not exhaustive, just catches obvious typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ─── In-process rate limiter ─────────────────────────────────────────────────
// Resets on server restart. Good enough to throttle casual abuse without Redis.
// Key: normalized email, value: array of submission timestamps (ms).

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX_PER_WINDOW = 3;

const rateMap = new Map<string, number[]>();

/**
 * Enforces per-email rate limiting for quote submissions.
 *
 * @param email - The submitter's email address (normalized before lookup)
 * @returns true if the submission is within the rate limit, false if throttled
 */
function checkRateLimit(email: string): boolean {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const window = rateMap.get(key) ?? [];
  const recent = window.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_PER_WINDOW) return false;
  rateMap.set(key, [...recent, now]);
  return true;
}

// ─── Validation helper ───────────────────────────────────────────────────────

/**
 * Validates and sanitises quote form input fields.
 * Returns an error message string if validation fails, null if all fields are valid.
 *
 * @param opts - Raw form field values
 * @returns Error string or null
 */
function validateQuoteInput(opts: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  message?: string;
}): string | null {
  if (!opts.companyName?.trim()) return `${LIMITS.companyName.label} is required.`;
  if (opts.companyName.trim().length > LIMITS.companyName.max) return `${LIMITS.companyName.label} must be under ${LIMITS.companyName.max} characters.`;
  if (!opts.contactName?.trim()) return `${LIMITS.contactName.label} is required.`;
  if (opts.contactName.trim().length > LIMITS.contactName.max) return `${LIMITS.contactName.label} must be under ${LIMITS.contactName.max} characters.`;
  if (!opts.email?.trim()) return `${LIMITS.email.label} is required.`;
  if (!EMAIL_RE.test(opts.email.trim())) return "Please enter a valid email address.";
  if (opts.phone && opts.phone.trim().length > LIMITS.phone.max) return `${LIMITS.phone.label} must be under ${LIMITS.phone.max} characters.`;
  if (opts.message && opts.message.trim().length > LIMITS.message.max) return `${LIMITS.message.label} must be under ${LIMITS.message.max} characters.`;
  return null;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Submits a new supplier quote request to the `quote_requests` table.
 * Publicly accessible — no Supabase auth required.
 *
 * Validation pipeline:
 *  1. Field validation (required fields, length limits, email format)
 *  2. In-process rate limit (3 submissions / hour / email)
 *  3. Trim + slice all strings before inserting
 *
 * @param opts.companyName       - Supplier's company name (required, ≤200 chars)
 * @param opts.contactName       - Contact person's name (required, ≤200 chars)
 * @param opts.email             - Contact email (required, valid format, ≤320 chars)
 * @param opts.phone             - Contact phone (optional, ≤30 chars)
 * @param opts.message           - Additional message (optional, ≤2000 chars)
 * @param opts.supplierAccountId - Pre-existing supplier account UUID (optional)
 * @returns `{ error }` — null on success, error message string on failure
 */
export async function submitQuoteRequest(opts: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  message?: string;
  supplierAccountId?: string;
}): Promise<{ error: string | null }> {
  // 1. Validate fields
  const validationError = validateQuoteInput(opts);
  if (validationError) return { error: validationError };

  // 2. Rate limit by email
  if (!checkRateLimit(opts.email)) {
    return {
      error:
        "Too many requests. Please wait before submitting again, or contact hq@cervos.online directly.",
    };
  }

  // 3. Sanitise — trim all strings before storage
  const supabase = await createClient();
  const { error } = await supabase.from("quote_requests").insert({
    company_name:        opts.companyName.trim().slice(0, LIMITS.companyName.max),
    contact_name:        opts.contactName.trim().slice(0, LIMITS.contactName.max),
    email:               opts.email.trim().slice(0, LIMITS.email.max),
    phone:               opts.phone?.trim().slice(0, LIMITS.phone.max) ?? null,
    message:             opts.message?.trim().slice(0, LIMITS.message.max) ?? null,
    supplier_account_id: opts.supplierAccountId ?? null,
    status:              "pending",
  });

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Fetches the most recent quote request submitted by the currently authenticated
 * supplier account. Used on the supplier dashboard to show application status.
 *
 * Reads from: `accounts` (to look up account by auth_user_id), then `quote_requests`.
 * Returns null if unauthenticated or no quote request found.
 *
 * @returns The most recent `quote_requests` row, or null
 */
export async function getMyQuoteRequest() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!account) return null;

  const { data } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("supplier_account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data;
}

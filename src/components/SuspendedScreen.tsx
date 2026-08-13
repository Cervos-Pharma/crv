/**
 * @file components/SuspendedScreen.tsx
 * @description Full-screen suspension notice rendered by the dashboard and
 *   supplier layouts when the authenticated account has `suspended_at` set.
 */
import Link from "next/link";

export default function SuspendedScreen({ reason }: { reason: string | null }) {
  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-surface-base border border-outline-variant rounded p-8 text-center">
        <span className="material-symbols-outlined text-[48px] text-error block mb-4">block</span>
        <h1 className="font-headline-md text-headline-md text-ink-deep mb-2">Account suspended</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-4">
          {reason || "This account has been suspended by the Cervos team."}
        </p>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-label-md text-label-md"
        >
          <span className="material-symbols-outlined text-[16px]">support_agent</span>
          Contact support
        </Link>
      </div>
    </div>
  );
}

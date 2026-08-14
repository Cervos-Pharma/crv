import { useState } from "react";
import { Pe } from "../lib/database";
import { Nd, Z8 } from "../lib/sync";

type OnboardingStep = "welcome" | "details" | "logo" | "link" | "done";

interface OnboardingProps {
  onComplete: () => void;
}

function ProgressIndicator({ current }: { current: OnboardingStep }) {
  const steps: OnboardingStep[] = ["welcome", "details", "logo", "link", "done"];
  const currentIndex = steps.indexOf(current);

  return (
    <div className="flex items-center gap-1.5 mb-6">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`h-1 flex-1 rounded-full transition-colors ${
            index <= currentIndex ? "bg-primary" : "bg-outline-variant"
          }`}
        />
      ))}
    </div>
  );
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [pharmacyName, setPharmacyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const inputClass =
    "w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const labelClass = "block text-xs font-semibold text-on-surface-variant mb-1";

  async function handleDetailsSubmit() {
    if (!pharmacyName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await Pe(
        `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ["pharmacy_name", JSON.stringify(pharmacyName.trim())]
      );
      setStep("logo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLink() {
    setIsLoading(true);
    setError(null);
    try {
      await Nd(email.trim(), password);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link account. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDone() {
    const isLinked = await Z8();
    if (!isLinked) {
      setError("You must link your account to continue");
      setStep("link");
      return;
    }
    onComplete();
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <ProgressIndicator current={step} />

        <div className="bg-surface-base border border-outline-variant rounded-2xl shadow-sm p-7">
          {step === "welcome" && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-primary">
                  pharmacy
                </span>
              </div>
              <h1 className="mt-5 font-headline text-2xl font-black text-on-surface">
                Cervos Pharmacy OS
              </h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                Offline-first point of sale for your pharmacy. Everything is
                stored locally — works even without internet.
              </p>
              <button
                onClick={() => setStep("details")}
                className="mt-6 w-full py-3 rounded-md bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity"
              >
                Get started
              </button>
            </div>
          )}

          {step === "details" && (
            <div>
              <h1 className="font-headline text-xl font-black text-on-surface">
                Your pharmacy
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Shown on receipts and reports.
              </p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className={labelClass}>Pharmacy name *</label>
                  <input
                    type="text"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Green Cross Pharmacy"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-3 text-sm text-error">{error}</p>
              )}

              <button
                onClick={handleDetailsSubmit}
                disabled={!pharmacyName.trim() || isLoading}
                className="mt-6 w-full py-3 rounded-md bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Continue"}
              </button>
            </div>
          )}

          {step === "logo" && (
            <div>
              <h1 className="font-headline text-xl font-black text-on-surface">
                Store logo
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Optional — shown on receipts.
              </p>

              <div className="mt-6 border-2 border-dashed border-outline-variant rounded-xl p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                  add_photo_alternate
                </span>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Click to upload or drag and drop
                </p>
              </div>

              <button
                onClick={() => setStep("link")}
                className="mt-6 w-full py-3 rounded-md bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity"
              >
                Continue
              </button>
            </div>
          )}

          {step === "link" && (
            <div>
              <h1 className="font-headline text-xl font-black text-on-surface">
                Link your account
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Connect to cloud to sync data across devices. This is required to complete setup.
              </p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@pharmacy.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-3 text-sm text-error">{error}</p>
              )}

              <button
                onClick={handleLink}
                disabled={isLoading || !email.trim() || !password}
                className="mt-6 w-full py-3 rounded-md bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? "Linking..." : "Link account"}
              </button>

              <p className="mt-4 text-xs text-center text-on-surface-variant">
                You must link your Supabase account to complete setup
              </p>
            </div>
          )}

          {step === "done" && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-secondary">
                  check_circle
                </span>
              </div>
              <h1 className="mt-5 font-headline text-2xl font-black text-on-surface">
                You&apos;re all set!
              </h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                Your pharmacy is linked and ready. Start by adding products to your
                inventory or open the POS terminal.
              </p>
              <button
                onClick={handleDone}
                className="mt-6 w-full py-3 rounded-md bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity"
              >
                Open POS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
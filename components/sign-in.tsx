"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { backendConfigured } from "./providers";
import { BrandMark } from "./brand";
import { ActionButton, InlineError } from "./ui";
import { EntryCard, EntryLayout } from "./entry-layout";

export function SignInScreen() {
  return backendConfigured ? (
    <ConnectedSignIn />
  ) : (
    <SignInContent ready={false} />
  );
}

function ConnectedSignIn() {
  const readiness = useQuery(api.auth.readiness);
  return (
    <SignInContent
      ready={readiness?.google ?? false}
      checking={readiness === undefined}
    />
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.31 2.99-7.35Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.05.97-3.38.97-2.6 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.31.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.51l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.71 9.4 5.95 12 5.95Z"
      />
    </svg>
  );
}

function SignInContent({
  ready,
  checking = false,
}: {
  ready: boolean;
  checking?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      // Do not reflect arbitrary provider errors or query strings into the UI.
      Promise.resolve().then(() =>
        setError("Google sign-in was not completed. Try again."),
      );
    }
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/sign-in?error=google",
      });
      if (result.error) throw new Error(result.error.message);
    } catch {
      setError(
        "Unable to connect to Google. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <EntryLayout>
      <EntryCard>
        <div
          aria-hidden
          className="mb-8 flex size-18 items-center justify-center rounded-[20px] bg-sage/80"
        >
          <BrandMark className="h-auto w-14" />
        </div>
        <h2
          id="sign-in-heading"
          className="text-[28px] leading-tight font-medium tracking-[-0.045em] text-foreground sm:text-[40px]"
        >
          Welcome, <span className="text-accent">Hustler.</span>
        </h2>
        <p className="text-sm leading-6 text-muted">
          Sign in with the Google account you were invited with.
        </p>
        <div className="mt-8">
          <ActionButton
            onPress={signIn}
            busy={busy}
            isDisabled={!ready}
            className="h-auto min-h-14 w-full gap-3 rounded-xl px-4 py-3 text-sm"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white">
              <GoogleIcon />
            </span>
            <span className="min-w-0 whitespace-normal leading-5">
              {checking
                ? "Checking sign-in…"
                : ready
                  ? "Continue with Google"
                  : "Google sign-in is not connected yet"}
            </span>
          </ActionButton>
          {error ? (
            <div className="mt-4">
              <InlineError message={error} />
            </div>
          ) : null}
          {!ready && !checking ? (
            <p className="mt-5 text-sm leading-6 text-muted">
              Your organizer will let you know when sign-in is ready.
            </p>
          ) : null}
        </div>
      </EntryCard>
    </EntryLayout>
  );
}

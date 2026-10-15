"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ActionButton, Field, InlineError } from "./ui";
import { signInReturnPath } from "@/lib/auth-return";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

function authError(code?: string) {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email or password is incorrect. If you usually use Google, choose Forgot password to set a password.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "Use no more than 128 characters for your password.";
    case "INVALID_TOKEN":
      return "This link has expired or has already been used. Request a new one.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Unable to complete this request. Check your connection and try again.";
  }
}

export function EmailAuthForm({ ready, checking, disabled, onBusyChange }: {
  ready: boolean;
  checking: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    Promise.resolve().then(() => {
      if (params.get("reset") === "true") {
        const resetToken = params.get("token");
        setToken(resetToken);
        setMode(resetToken ? "reset" : "forgot");
        if (!resetToken || params.has("error")) setError("This reset link is invalid or has expired. Request a new one.");
      } else if (params.has("error") && params.get("error") !== "google") {
        setError("This verification link is invalid or has expired. Sign in to receive a new one.");
      }
    });
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setCanResend(false);
    setToken(null);
    window.history.replaceState(null, "", signInReturnPath("/sign-in"));
  }

  function updateBusy(value: boolean) {
    setBusy(value);
    onBusyChange(value);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || disabled) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    setError(null);
    setNotice(null);
    setCanResend(false);
    if ((mode === "sign-up" || mode === "reset") && password !== values.get("confirmPassword")) {
      setError("Your passwords do not match.");
      return;
    }
    updateBusy(true);
    try {
      const address = email.trim().toLowerCase();
      if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email: address, redirectTo: "/sign-in?reset=true" });
        if (result.error) { setError(authError(result.error.code)); return; }
        setNotice("If an account exists for this email, you’ll receive a link to set a new password. Check your spam folder too.");
      } else if (mode === "reset") {
        if (!token) { setError("Request a new password reset link."); return; }
        const result = await authClient.resetPassword({ token, newPassword: password });
        if (result.error) { setError(authError(result.error.code)); return; }
        form.reset();
        changeMode("sign-in");
        setNotice("Your password has been updated. Sign in with your new password.");
      } else if (mode === "sign-up") {
        // Verification is required, so sign-up creates no session. Avoid a
        // session refresh that would remount the gateway and clear this notice.
        const result = await authClient.signUp.email({ name: String(values.get("name") ?? "").trim(), email: address, password, callbackURL: signInReturnPath("/sign-in") }, { disableSignal: true });
        if (result.error) { setError(authError(result.error.code)); return; }
        form.reset();
        setNotice("Check your inbox for a verification link to finish creating your account. If you already have an account, sign in or reset your password.");
        setCanResend(true);
      } else {
        const result = await authClient.signIn.email({ email: address, password, callbackURL: signInReturnPath("/sign-in") });
        if (result.error) {
          if (result.error.code === "EMAIL_NOT_VERIFIED") {
            setError("Verify your email before signing in. Check your inbox for a verification link, or send another below.");
            setCanResend(true);
          } else setError(authError(result.error.code));
          return;
        }
        router.replace(signInReturnPath("/"));
        router.refresh();
      }
    } catch {
      setError("Unable to complete this request. Check your connection and try again.");
      if (mode === "sign-up") setCanResend(true);
    } finally {
      updateBusy(false);
    }
  }

  async function resendVerification() {
    if (!ready || busy || disabled) return;
    updateBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.sendVerificationEmail({ email: email.trim().toLowerCase(), callbackURL: signInReturnPath("/sign-in") });
      if (result.error) { setError(authError(result.error.code)); return; }
      setNotice("If your account needs verification, a new link has been sent. Check your inbox and spam folder.");
    } catch {
      setError("Unable to send a verification email. Please try again.");
    } finally {
      updateBusy(false);
    }
  }

  const locked = !ready || disabled || busy;
  const creating = mode === "sign-up";
  const resetting = mode === "reset";
  const title = creating ? "Create your account" : mode === "forgot" ? "Set or reset your password" : resetting ? "Choose a new password" : "Sign in with email";

  return (
    <div className="mt-6">
      {mode !== "sign-in" ? <h3 className="text-base font-medium text-foreground">{title}</h3> : null}
      <form key={mode} onSubmit={submit} className={mode === "sign-in" ? "space-y-4" : "mt-4 space-y-4"} aria-label={title} aria-busy={busy}>
        <fieldset disabled={locked} className="min-w-0 space-y-4">
          {creating ? <Field label="Full name" name="name" autoComplete="name" required maxLength={100} pattern=".*\S.*" /> : null}
          {!resetting ? <Field label="Email address" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /> : null}
          {mode !== "forgot" ? <Field label={resetting ? "New password" : "Password"} name="password" type="password" autoComplete={creating || resetting ? "new-password" : "current-password"} required minLength={creating || resetting ? 8 : undefined} maxLength={128} aria-describedby={creating || resetting ? "password-hint" : undefined} /> : null}
          {creating || resetting ? <>
            <p id="password-hint" className="text-xs leading-5 text-muted-foreground">Use 8–128 characters.</p>
            <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          </> : null}
        </fieldset>
        <InlineError message={error} />
        {notice ? <p role="status" className="rounded-xl bg-sage/60 p-3.5 text-sm leading-6 text-forest">{notice}</p> : null}
        <ActionButton type="submit" busy={busy} disabled={!ready || disabled} className="w-full">
          {checking ? "Checking sign-in…" : creating ? "Create account" : mode === "forgot" ? "Send password reset link" : resetting ? "Save new password" : "Sign in"}
        </ActionButton>
      </form>
      {canResend ? <ActionButton appearance="secondary" disabled={locked} onClick={resendVerification} className="mt-3 w-full">Resend verification email</ActionButton> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={busy || disabled} onClick={() => changeMode(mode === "sign-in" ? "sign-up" : "sign-in")} className="rounded-sm font-medium text-forest underline-offset-4 hover:underline disabled:opacity-50">
          {mode === "sign-in" ? "Create an account" : "Back to sign in"}
        </button>
        {mode === "sign-in" ? <button type="button" disabled={busy || disabled} onClick={() => changeMode("forgot")} className="rounded-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50">Forgot password?</button> : null}
      </div>
    </div>
  );
}

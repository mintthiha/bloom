import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import {
  BACKEND_UNAVAILABLE_SIGN_IN_CODE,
  SERVER_UNAVAILABLE_MESSAGE,
  parseJsonOrNull,
} from "@/lib/backend-errors";
import { SAVED_ACCOUNT_STORAGE_KEY, SavedAccount, parseSavedAccount } from "@/lib/saved-account";
import {
  DEMO_FAILURE_MESSAGE,
  describeCredentialSignInFailure,
  describeDemoFailure,
} from "./sign-in-messages";

/**
 * Owns every sign-in path on the login page — saved sign-in, email + password (with remember-me),
 * and the demo — plus the state they share. `credentialError` lives here because both the saved
 * sign-in and the email form report into the same message.
 */
export function useLoginActions() {
  const [credentialEmail, setCredentialEmail] = useState("");
  const [credentialPassword, setCredentialPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [isCredentialSubmitting, setIsCredentialSubmitting] = useState(false);
  const [isSavedSigningIn, setIsSavedSigningIn] = useState(false);
  const [savedAccount, setSavedAccount] = useState<SavedAccount | null>(null);
  const [isTryingDemo, setIsTryingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  /** Reads any saved account from localStorage on mount, rewriting older entries without their token. */
  useEffect(() => {
    try {
      const storedAccount = parseSavedAccount(localStorage.getItem(SAVED_ACCOUNT_STORAGE_KEY));
      if (storedAccount) {
        localStorage.setItem(SAVED_ACCOUNT_STORAGE_KEY, JSON.stringify(storedAccount));
      } else {
        localStorage.removeItem(SAVED_ACCOUNT_STORAGE_KEY);
      }
      setSavedAccount(storedAccount);
    } catch {
      // Storage is unavailable (private mode, blocked site data), so there is no saved account.
    }
  }, []);

  /** Signs in with the saved sign-in token in this browser's httpOnly cookie — no password needed. */
  async function handleSavedSignIn() {
    if (!savedAccount) return;
    setCredentialError(null);
    setIsSavedSigningIn(true);
    try {
      const result = await signIn("credentials", {
        useSavedSignIn: "true",
        callbackUrl: "/",
        redirect: false,
      });
      if (result?.code === BACKEND_UNAVAILABLE_SIGN_IN_CODE) {
        // The token may still be valid — keep it so the user can retry once the server is up.
        setCredentialError(SERVER_UNAVAILABLE_MESSAGE);
      } else if (result?.error) {
        localStorage.removeItem(SAVED_ACCOUNT_STORAGE_KEY);
        setSavedAccount(null);
        setCredentialError("Your saved sign-in has expired. Please sign in again.");
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setCredentialError("Something went wrong. Please try again.");
    } finally {
      setIsSavedSigningIn(false);
    }
  }

  /** Clears the saved account; the server revokes the token in the cookie and clears the cookie. */
  async function handleForgetSavedAccount() {
    if (!savedAccount) return;
    localStorage.removeItem(SAVED_ACCOUNT_STORAGE_KEY);
    setSavedAccount(null);
    fetch("/api/remember-revoke", { method: "DELETE" }).catch(() => {});
  }

  /**
   * Has the server issue a remember-me token into an httpOnly cookie, and saves the email for the
   * "Continue as…" button. Best-effort: the user is already signed in, so a failure here must not
   * block the redirect.
   */
  async function saveRememberedAccount() {
    try {
      const res = await fetch("/api/remember-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credentialEmail, password: credentialPassword }),
      });
      if (!res.ok) return;
      const rememberedAccount: SavedAccount = { email: credentialEmail };
      localStorage.setItem(SAVED_ACCOUNT_STORAGE_KEY, JSON.stringify(rememberedAccount));
    } catch {
      // Skip remembering this time; signing in already succeeded.
    }
  }

  /** Signs in with email and password, issuing a remember-me token when the checkbox is checked. */
  async function handleCredentialSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCredentialError(null);
    setIsCredentialSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: credentialEmail,
        password: credentialPassword,
        callbackUrl: "/",
        redirect: false,
      });
      if (result?.error) {
        setCredentialError(describeCredentialSignInFailure(result.code));
        return;
      }
      if (rememberMe) await saveRememberedAccount();
      if (result?.url) window.location.href = result.url;
    } catch {
      setCredentialError("Something went wrong. Please try again.");
    } finally {
      setIsCredentialSubmitting(false);
    }
  }

  /** Provisions a throwaway demo account with six months of history and signs the visitor into it. */
  async function handleTryDemo() {
    setDemoError(null);
    setIsTryingDemo(true);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      if (!res.ok) {
        const failureBody = res.status === 429 ? parseJsonOrNull(await res.text()) : null;
        setDemoError(describeDemoFailure(res.status, failureBody));
        return;
      }
      const data = await res.json();
      const result = await signIn("credentials", {
        rememberToken: data.token,
        callbackUrl: "/",
        redirect: false,
      });
      if (result?.error) {
        setDemoError(
          result.code === BACKEND_UNAVAILABLE_SIGN_IN_CODE
            ? SERVER_UNAVAILABLE_MESSAGE
            : DEMO_FAILURE_MESSAGE
        );
        return;
      }
      if (result?.url) window.location.href = result.url;
    } catch {
      setDemoError("Something went wrong. Please try again.");
    } finally {
      setIsTryingDemo(false);
    }
  }

  return {
    credentialEmail,
    setCredentialEmail,
    credentialPassword,
    setCredentialPassword,
    rememberMe,
    setRememberMe,
    credentialError,
    isCredentialSubmitting,
    isSavedSigningIn,
    savedAccount,
    isTryingDemo,
    demoError,
    handleSavedSignIn,
    handleForgetSavedAccount,
    handleCredentialSignIn,
    handleTryDemo,
  };
}

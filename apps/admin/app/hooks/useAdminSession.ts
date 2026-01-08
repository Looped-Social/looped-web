import { useEffect, useState } from "react";

import type { User } from "firebase/auth";

import { fetchAdminMe, AdminApiError } from "../lib/adminApi";
import {
  getFirebaseErrorMessage,
  observeAuthState,
  signInWithApple,
  signInWithGoogle,
  signInWithEmailPassword,
  signOutUser,
} from "../lib/firebaseClient";
import type { AdminMe } from "../types/admin";

export type AdminSessionStatus =
  | "loading"
  | "unauthenticated"
  | "checking"
  | "authorized"
  | "forbidden"
  | "unverified"
  | "error";

type AdminSessionState = {
  status: AdminSessionStatus;
  admin: AdminMe | null;
  userEmail: string | null;
  error: string | null;
};

const initialState: AdminSessionState = {
  status: "loading",
  admin: null,
  userEmail: null,
  error: null,
};

export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>(initialState);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const handleUser = async (user: User | null) => {
      if (!active) return;

      if (!user) {
        setState({ status: "unauthenticated", admin: null, userEmail: null, error: null });
        return;
      }

      const email = user.email ?? null;

      if (!user.emailVerified) {
        setState({ status: "unverified", admin: null, userEmail: email, error: null });
        return;
      }

      setState((prev) => ({ ...prev, status: "checking", userEmail: email, error: null }));

      try {
        const token = await user.getIdToken();
        const admin = await fetchAdminMe(token);
        if (!active) return;
        setState({ status: "authorized", admin, userEmail: email, error: null });
      } catch (error) {
        if (!active) return;
        if (error instanceof AdminApiError) {
          if (error.status === 401) {
            setState({
              status: "unauthenticated",
              admin: null,
              userEmail: null,
              error: "Session expired. Sign in again.",
            });
            return;
          }
          if (error.status === 403) {
            setState({ status: "forbidden", admin: null, userEmail: email, error: null });
            return;
          }
        }
        const message = error instanceof Error ? error.message : "Unable to load admin access.";
        setState({ status: "error", admin: null, userEmail: email, error: message });
      }
    };

    observeAuthState(handleUser)
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to initialize authentication.";
        setState({ status: "error", admin: null, userEmail: null, error: message });
      });

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const startSignIn = async (action: () => Promise<unknown>) => {
    setState((prev) => ({ ...prev, status: "checking", error: null }));
    try {
      await action();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "unauthenticated",
        error: getFirebaseErrorMessage(error),
      }));
    }
  };

  const signIn = async (email: string, password: string) => {
    await startSignIn(() => signInWithEmailPassword(email, password));
  };

  const signInWithGoogleProvider = async () => {
    await startSignIn(signInWithGoogle);
  };

  const signInWithAppleProvider = async () => {
    await startSignIn(signInWithApple);
  };

  const signOut = async () => {
    await signOutUser();
  };

  return {
    ...state,
    signIn,
    signInWithGoogle: signInWithGoogleProvider,
    signInWithApple: signInWithAppleProvider,
    signOut,
  };
}

import { useEffect, useState } from "react";

import type { User } from "firebase/auth";

import {
  getFirebaseErrorMessage,
  observeAuthState,
  signInWithApple,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
} from "@/lib/firebaseClient";

export type UserSessionStatus = "loading" | "unauthenticated" | "checking" | "authenticated" | "error";

type UserSessionState = {
  status: UserSessionStatus;
  user: User | null;
  error: string | null;
};

const initialState: UserSessionState = {
  status: "loading",
  user: null,
  error: null,
};

export function useUserSession() {
  const [state, setState] = useState<UserSessionState>(initialState);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const handleUser = (user: User | null) => {
      if (!active) return;
      if (!user) {
        setState({ status: "unauthenticated", user: null, error: null });
        return;
      }
      setState({ status: "authenticated", user, error: null });
    };

    observeAuthState(handleUser)
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to initialize authentication.";
        setState({ status: "error", user: null, error: message });
      });

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const startSignIn = async <TResult,>(action: () => Promise<TResult>) => {
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

import { useEffect, useState } from "react";

import type { User } from "firebase/auth";

import { AUTH_GATE_EVENT, type AuthGateCode, type AuthGateEventDetail } from "@/lib/apiBase";
import {
  assertWebAccessEligible,
  getFirebaseErrorMessage,
  observeAuthState,
  signInWithApple,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
  WebAccessError,
} from "@/lib/firebaseClient";

export type UserSessionStatus = "loading" | "unauthenticated" | "checking" | "authenticated" | "error";
export type UserAccessState = "signed_out" | "signed_in_blocked" | "active" | "deleted";

type UserSessionState = {
  status: UserSessionStatus;
  user: User | null;
  error: string | null;
  authGateCode: AuthGateCode | null;
  onboardingStep: string | null;
};

const initialState: UserSessionState = {
  status: "loading",
  user: null,
  error: null,
  authGateCode: null,
  onboardingStep: null,
};

function authGateMessage(code: AuthGateCode): string {
  if (code === "account_deleted") {
    return "This account was deleted. Contact support if you need help restoring access.";
  }
  return "Finish account setup on iOS to continue.";
}

export function useUserSession() {
  const [state, setState] = useState<UserSessionState>(initialState);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let authCheckRequestId = 0;
    let pendingUnauthenticatedError: string | null = null;
    let pendingAuthGateCode: AuthGateCode | null = null;
    let pendingOnboardingStep: string | null = null;

    const handleUser = (user: User | null) => {
      if (!active) return;
      if (!user) {
        const error = pendingUnauthenticatedError;
        const authGateCode = pendingAuthGateCode;
        const onboardingStep = pendingOnboardingStep;
        pendingUnauthenticatedError = null;
        pendingAuthGateCode = null;
        pendingOnboardingStep = null;
        setState({
          status: "unauthenticated",
          user: null,
          error,
          authGateCode,
          onboardingStep,
        });
        return;
      }

      const requestId = ++authCheckRequestId;
      setState({ status: "checking", user: null, error: null, authGateCode: null, onboardingStep: null });
      void (async () => {
        try {
          await assertWebAccessEligible();
          if (!active || requestId !== authCheckRequestId) return;
          pendingAuthGateCode = null;
          pendingOnboardingStep = null;
          setState({ status: "authenticated", user, error: null, authGateCode: null, onboardingStep: null });
        } catch (error) {
          let message = error instanceof Error ? error.message : "Unable to verify account access.";
          if (error instanceof WebAccessError) {
            if (
              error.code === "user_not_provisioned" ||
              error.code === "onboarding_incomplete" ||
              error.code === "account_deleted"
            ) {
              pendingAuthGateCode = error.code;
              pendingOnboardingStep = error.onboardingStep ?? null;
              message = authGateMessage(error.code);
            } else {
              pendingAuthGateCode = null;
              pendingOnboardingStep = null;
            }
          }

          pendingUnauthenticatedError = message;
          try {
            await signOutUser();
          } catch {
            // best effort sign-out to clear unsupported sessions
          }
          if (!active || requestId !== authCheckRequestId) return;
          setState({
            status: "unauthenticated",
            user: null,
            error: pendingUnauthenticatedError,
            authGateCode: pendingAuthGateCode,
            onboardingStep: pendingOnboardingStep,
          });
        }
      })();
    };

    const handleAuthGateEvent = (event: Event) => {
      if (!active) return;
      const detail = (event as CustomEvent<AuthGateEventDetail>).detail;
      if (!detail) return;

      const gateCode = detail.code;
      const onboardingStep = null;
      const gateMessage = authGateMessage(gateCode);

      pendingAuthGateCode = gateCode;
      pendingOnboardingStep = onboardingStep;
      pendingUnauthenticatedError = gateMessage;

      setState((prev) => ({
        ...prev,
        status: "checking",
        error: null,
      }));

      void signOutUser()
        .catch(() => {
          // best effort sign-out
        })
        .finally(() => {
          if (!active) return;
          setState({
            status: "unauthenticated",
            user: null,
            error: gateMessage,
            authGateCode: gateCode,
            onboardingStep,
          });
        });
    };

    observeAuthState(handleUser)
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to initialize authentication.";
        setState({
          status: "error",
          user: null,
          error: message,
          authGateCode: null,
          onboardingStep: null,
        });
      });

    if (typeof window !== "undefined") {
      window.addEventListener(AUTH_GATE_EVENT, handleAuthGateEvent as EventListener);
    }

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener(AUTH_GATE_EVENT, handleAuthGateEvent as EventListener);
      }
    };
  }, []);

  const startSignIn = async <TResult,>(action: () => Promise<TResult>) => {
    setState((prev) => ({ ...prev, status: "checking", error: null, authGateCode: null, onboardingStep: null }));
    try {
      await action();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "unauthenticated",
        error: getFirebaseErrorMessage(error),
        authGateCode: null,
        onboardingStep: null,
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

  const accessState: UserAccessState =
    statusToAccessState(state.status, state.authGateCode);

  return {
    ...state,
    accessState,
    signIn,
    signInWithGoogle: signInWithGoogleProvider,
    signInWithApple: signInWithAppleProvider,
    signOut,
  };
}

function statusToAccessState(status: UserSessionStatus, authGateCode: AuthGateCode | null): UserAccessState {
  if (status === "authenticated") return "active";
  if (authGateCode === "account_deleted") return "deleted";
  if (authGateCode === "user_not_provisioned" || authGateCode === "onboarding_incomplete") {
    return "signed_in_blocked";
  }
  return "signed_out";
}

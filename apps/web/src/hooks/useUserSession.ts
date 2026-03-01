import { useEffect, useState } from "react";

import type { User } from "firebase/auth";

import { AUTH_GATE_EVENT, type AuthGateCode, type AuthGateEventDetail } from "@/lib/apiBase";
import {
  getFirebaseErrorMessage,
  observeAuthState,
  signInWithApple,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
  signUpWithEmailPassword,
} from "@/lib/firebaseClient";
import { fetchSessionBootstrap, SessionBootstrapError, type SessionBootstrap } from "@/lib/sessionBootstrapApi";

export type UserSessionStatus = "loading" | "unauthenticated" | "checking" | "authenticated" | "error";
export type UserAccessState = "signed_out" | "signed_in_blocked" | "active" | "deleted" | "delete_pending";

type UserSessionState = {
  status: UserSessionStatus;
  user: User | null;
  error: string | null;
  authGateCode: AuthGateCode | null;
  onboardingStep: string | null;
  bootstrap: SessionBootstrap | null;
};

const initialState: UserSessionState = {
  status: "loading",
  user: null,
  error: null,
  authGateCode: null,
  onboardingStep: null,
  bootstrap: null,
};

let cachedSessionState: UserSessionState = initialState;
let lastBootstrapCheck: { uid: string; at: number; state: UserSessionState } | null = null;
const SESSION_RECHECK_WINDOW_MS = 15_000;

function normalizeAuthGateCode(code: string | null): AuthGateCode | null {
  if (
    code === "user_not_provisioned" ||
    code === "onboarding_incomplete" ||
    code === "account_deleted" ||
    code === "account_delete_pending"
  ) {
    return code;
  }
  return null;
}

function authGateMessage(code: AuthGateCode): string {
  if (code === "account_delete_pending") {
    return "Your account deletion is still processing. Try again shortly.";
  }
  if (code === "account_deleted") {
    return "This account was deleted. Contact support if you need help restoring access.";
  }
  return "Finish onboarding to continue.";
}

function deriveBootstrapState({
  user,
  bootstrap,
}: {
  user: User;
  bootstrap: SessionBootstrap;
}): UserSessionState {
  let gateCode = normalizeAuthGateCode(bootstrap.errorCode);
  if (!gateCode && !bootstrap.onboardingComplete) {
    gateCode = "onboarding_incomplete";
  }

  const onboardingStep = bootstrap.onboardingStageV2 ?? bootstrap.onboardingStep;
  if (gateCode === "account_deleted" || gateCode === "account_delete_pending") {
    return {
      status: "unauthenticated",
      user: null,
      error: authGateMessage(gateCode),
      authGateCode: gateCode,
      onboardingStep,
      bootstrap,
    };
  }

  return {
    status: "authenticated",
    user,
    error: null,
    authGateCode: gateCode,
    onboardingStep,
    bootstrap,
  };
}

export function useUserSession() {
  const [state, setState] = useState<UserSessionState>(cachedSessionState);

  const setAndCacheState = (next: UserSessionState | ((prev: UserSessionState) => UserSessionState)) => {
    setState((prev) => {
      const resolved = typeof next === "function" ? (next as (value: UserSessionState) => UserSessionState)(prev) : next;
      cachedSessionState = resolved;
      return resolved;
    });
  };

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let authCheckRequestId = 0;

    const loadBootstrap = async ({
      user,
      requestId,
      force = false,
    }: {
      user: User;
      requestId: number;
      force?: boolean;
    }) => {
      if (
        !force &&
        lastBootstrapCheck &&
        lastBootstrapCheck.uid === user.uid &&
        Date.now() - lastBootstrapCheck.at < SESSION_RECHECK_WINDOW_MS
      ) {
        if (!active || requestId !== authCheckRequestId) return;
        setAndCacheState(lastBootstrapCheck.state);
        return;
      }

      setAndCacheState((prev) => ({
        ...prev,
        status: "checking",
        user,
        error: null,
      }));

      try {
        const bootstrap = await fetchSessionBootstrap();
        if (!active || requestId !== authCheckRequestId) return;
        const nextState = deriveBootstrapState({ user, bootstrap });
        lastBootstrapCheck = {
          uid: user.uid,
          at: Date.now(),
          state: nextState,
        };
        setAndCacheState(nextState);
      } catch (error) {
        if (!active || requestId !== authCheckRequestId) return;

        const message = error instanceof Error ? error.message : "Unable to verify account access.";
        if (error instanceof SessionBootstrapError && error.status === 401) {
          try {
            await signOutUser();
          } catch {
            // best effort sign-out on invalid token/session
          }
          setAndCacheState({
            status: "unauthenticated",
            user: null,
            error: "Your session expired. Please sign in again.",
            authGateCode: null,
            onboardingStep: null,
            bootstrap: null,
          });
          return;
        }

        setAndCacheState({
          status: "error",
          user,
          error: message,
          authGateCode: null,
          onboardingStep: null,
          bootstrap: null,
        });
      }
    };

    const handleUser = (user: User | null) => {
      if (!active) return;
      if (!user) {
        setAndCacheState({
          status: "unauthenticated",
          user: null,
          error: null,
          authGateCode: null,
          onboardingStep: null,
          bootstrap: null,
        });
        return;
      }

      const requestId = ++authCheckRequestId;
      void loadBootstrap({ user, requestId });
    };

    const handleAuthGateEvent = (event: Event) => {
      if (!active) return;
      const detail = (event as CustomEvent<AuthGateEventDetail>).detail;
      if (!detail) return;
      const gateCode = detail.code;

      if (gateCode === "account_deleted" || gateCode === "account_delete_pending") {
        void signOutUser().catch(() => {
          // best effort
        });
        lastBootstrapCheck = null;
        setAndCacheState({
          status: "unauthenticated",
          user: null,
          error: authGateMessage(gateCode),
          authGateCode: gateCode,
          onboardingStep: null,
          bootstrap: null,
        });
        return;
      }

      setAndCacheState((prev) => ({
        ...prev,
        status: prev.user ? "authenticated" : "unauthenticated",
        authGateCode: gateCode,
        error: prev.user ? null : authGateMessage(gateCode),
      }));

      const currentUser = cachedSessionState.user;
      if (!currentUser) return;
      const requestId = ++authCheckRequestId;
      void loadBootstrap({ user: currentUser, requestId, force: true });
    };

    observeAuthState(handleUser)
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to initialize authentication.";
        setAndCacheState({
          status: "error",
          user: null,
          error: message,
          authGateCode: null,
          onboardingStep: null,
          bootstrap: null,
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
    setAndCacheState((prev) => ({
      ...prev,
      status: "checking",
      error: null,
      authGateCode: null,
      onboardingStep: null,
      bootstrap: null,
    }));
    try {
      await action();
      lastBootstrapCheck = null;
    } catch (error) {
      setAndCacheState((prev) => ({
        ...prev,
        status: "unauthenticated",
        error: getFirebaseErrorMessage(error),
        authGateCode: null,
        onboardingStep: null,
        bootstrap: null,
      }));
    }
  };

  const signIn = async (email: string, password: string) => {
    await startSignIn(() => signInWithEmailPassword(email, password));
  };

  const signUp = async (email: string, password: string) => {
    await startSignIn(() => signUpWithEmailPassword(email, password));
  };

  const signInWithGoogleProvider = async () => {
    await startSignIn(signInWithGoogle);
  };

  const signInWithAppleProvider = async () => {
    await startSignIn(signInWithApple);
  };

  const signOut = async () => {
    lastBootstrapCheck = null;
    await signOutUser();
  };

  const refreshSession = async () => {
    const user = cachedSessionState.user;
    if (!user) return;
    const bootstrap = await fetchSessionBootstrap();
    const nextState = deriveBootstrapState({ user, bootstrap });
    lastBootstrapCheck = {
      uid: user.uid,
      at: Date.now(),
      state: nextState,
    };
    setAndCacheState(nextState);
  };

  const accessState: UserAccessState = statusToAccessState(state.status, state.authGateCode);

  return {
    ...state,
    accessState,
    signIn,
    signUp,
    signInWithGoogle: signInWithGoogleProvider,
    signInWithApple: signInWithAppleProvider,
    signOut,
    refreshSession,
  };
}

function statusToAccessState(status: UserSessionStatus, authGateCode: AuthGateCode | null): UserAccessState {
  if (authGateCode === "account_delete_pending") return "delete_pending";
  if (authGateCode === "account_deleted") return "deleted";
  if (authGateCode === "user_not_provisioned" || authGateCode === "onboarding_incomplete") {
    return "signed_in_blocked";
  }
  if (status === "authenticated") return "active";
  return "signed_out";
}

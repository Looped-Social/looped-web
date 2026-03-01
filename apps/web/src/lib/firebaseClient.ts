import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import type { Auth, User, UserCredential } from "firebase/auth";
import { getApiBase, getAuthGateCode, type AuthGateCode } from "./apiBase";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedAuthModule: typeof import("firebase/auth") | null = null;
let initPromise: Promise<void> | null = null;
let authReadyPromise: Promise<User | null> | null = null;

function getFirebaseConfig(): FirebaseOptions {
  const config: FirebaseOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  const required: Array<keyof FirebaseOptions> = ["apiKey", "authDomain", "projectId", "appId"];
  const missing = required.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(
      `Missing Firebase config values: ${missing.join(", ")}. Add them to apps/web/.env.`
    );
  }

  return config;
}

async function ensureFirebase(): Promise<void> {
  if (typeof window === "undefined") return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const appModule = await import("firebase/app");
    cachedAuthModule = await import("firebase/auth");

    const existing = appModule.getApps();
    cachedApp = existing.length ? existing[0] : appModule.initializeApp(getFirebaseConfig());
    cachedAuth = cachedAuthModule.getAuth(cachedApp);
  })();

  return initPromise;
}

async function waitForAuthState(timeoutMs = 5000): Promise<User | null> {
  const auth = cachedAuth;
  const authModule = cachedAuthModule;
  if (!auth || !authModule) {
    throw new Error("Firebase auth failed to initialize.");
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise<User | null>((resolve, reject) => {
      let completed = false;
      let unsubscribe: (() => void) | null = null;
      const timer = window.setTimeout(() => {
        if (completed) return;
        completed = true;
        if (unsubscribe) unsubscribe();
        authReadyPromise = null;
        reject(new Error("Timed out waiting for Firebase auth state."));
      }, timeoutMs);

      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          if (completed) return;
          completed = true;
          window.clearTimeout(timer);
          if (unsubscribe) unsubscribe();
          authReadyPromise = null;
          resolve(user);
        },
        (error) => {
          if (completed) return;
          completed = true;
          window.clearTimeout(timer);
          if (unsubscribe) unsubscribe();
          authReadyPromise = null;
          reject(error);
        }
      );
    });
  }

  return authReadyPromise;
}

export async function observeAuthState(callback: (user: User | null) => void) {
  await ensureFirebase();
  if (!cachedAuth || !cachedAuthModule) {
    throw new Error("Firebase auth failed to initialize.");
  }
  return cachedAuthModule.onAuthStateChanged(cachedAuth, callback);
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<UserCredential> {
  await ensureFirebase();
  if (!cachedAuth || !cachedAuthModule) {
    throw new Error("Firebase auth failed to initialize.");
  }
  return cachedAuthModule.signInWithEmailAndPassword(cachedAuth, email, password);
}

export async function signUpWithEmailPassword(
  email: string,
  password: string
): Promise<UserCredential> {
  await ensureFirebase();
  if (!cachedAuth || !cachedAuthModule) {
    throw new Error("Firebase auth failed to initialize.");
  }
  return cachedAuthModule.createUserWithEmailAndPassword(cachedAuth, email, password);
}

export async function signInWithGoogle(): Promise<UserCredential> {
  await ensureFirebase();
  if (!cachedAuth || !cachedAuthModule) {
    throw new Error("Firebase auth failed to initialize.");
  }
  const provider = new cachedAuthModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return cachedAuthModule.signInWithPopup(cachedAuth, provider);
}

export async function signInWithApple(): Promise<UserCredential> {
  await ensureFirebase();
  if (!cachedAuth || !cachedAuthModule) {
    throw new Error("Firebase auth failed to initialize.");
  }
  const provider = new cachedAuthModule.OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return cachedAuthModule.signInWithPopup(cachedAuth, provider);
}

export async function signOutUser(): Promise<void> {
  await ensureFirebase();
  if (!cachedAuth || !cachedAuthModule) {
    throw new Error("Firebase auth failed to initialize.");
  }
  return cachedAuthModule.signOut(cachedAuth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await ensureFirebase();
  if (!cachedAuth || !cachedAuthModule) {
    throw new Error("Firebase auth failed to initialize.");
  }
  return cachedAuthModule.sendPasswordResetEmail(cachedAuth, email);
}

export async function getFirebaseIdToken(): Promise<string> {
  await ensureFirebase();
  if (!cachedAuth) {
    throw new Error("Firebase auth failed to initialize.");
  }
  let user = cachedAuth.currentUser;
  if (!user) {
    user = await waitForAuthState();
  }
  if (!user) {
    throw new Error("No authenticated user.");
  }
  return user.getIdToken();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

function parseErrorPayload(details?: string): Record<string, unknown> | null {
  if (!details || details.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(details) as unknown;
    if (!isRecord(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractOnboardingStep(details?: string): string | undefined {
  const payload = parseErrorPayload(details);
  if (!payload) return undefined;
  return normalizeOptional(payload.onboarding_step ?? payload.onboardingStep);
}

function onboardingCompleteFromPayload(payload: unknown): boolean | undefined {
  if (!isRecord(payload)) return undefined;
  const userPayload = isRecord(payload.user) ? payload.user : payload;

  return (
    getBoolean(userPayload.onboarding_complete) ??
    getBoolean(userPayload.onboardingComplete) ??
    getBoolean(payload.onboarding_complete) ??
    getBoolean(payload.onboardingComplete)
  );
}

const WEB_ACCESS_REQUIRED_MESSAGE =
  "Complete account setup before continuing on web.";
const WEB_ACCESS_CHECK_FAILED_MESSAGE = "Unable to verify account access right now. Please try again.";

export type WebAccessErrorCode = AuthGateCode | "unauthorized" | "unknown";

export class WebAccessError extends Error {
  code: WebAccessErrorCode;
  onboardingStep?: string;

  constructor({
    code,
    message,
    onboardingStep,
  }: {
    code: WebAccessErrorCode;
    message: string;
    onboardingStep?: string;
  }) {
    super(message);
    this.code = code;
    this.onboardingStep = onboardingStep;
  }
}

function resolveWebAccessMessage(code: AuthGateCode): string {
  if (code === "account_delete_pending") {
    return "Your account deletion is still in progress. Please wait before signing in again.";
  }
  if (code === "account_deleted") {
    return "This account was deleted. Contact support if you need help restoring access.";
  }
  return WEB_ACCESS_REQUIRED_MESSAGE;
}

export async function assertWebAccessEligible(): Promise<void> {
  const token = await getFirebaseIdToken();
  const response = await fetch(`${getApiBase()}/v1/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    const gateCode = getAuthGateCode(response.status, details);
    if (gateCode) {
      throw new WebAccessError({
        code: gateCode,
        message: resolveWebAccessMessage(gateCode),
        onboardingStep: gateCode === "onboarding_incomplete" ? extractOnboardingStep(details) : undefined,
      });
    }

    if (response.status === 401) {
      throw new WebAccessError({
        code: "unauthorized",
        message: "Your session could not be verified. Please try signing in again.",
      });
    }

    throw new WebAccessError({
      code: "unknown",
      message: WEB_ACCESS_CHECK_FAILED_MESSAGE,
    });
  }

  const text = (await response.text()).trim();
  if (!text) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new WebAccessError({
      code: "unknown",
      message: WEB_ACCESS_CHECK_FAILED_MESSAGE,
    });
  }

  const onboardingComplete = onboardingCompleteFromPayload(parsed);
  if (onboardingComplete === false) {
    throw new WebAccessError({
      code: "onboarding_incomplete",
      message: WEB_ACCESS_REQUIRED_MESSAGE,
      onboardingStep: normalizeOptional(
        isRecord(parsed)
          ? (isRecord(parsed.user) ? parsed.user.onboarding_step ?? parsed.user.onboardingStep : parsed.onboarding_step ?? parsed.onboardingStep)
          : undefined
      ),
    });
  }
}

export function getFirebaseErrorMessage(error: unknown): string {
  if (error instanceof WebAccessError) {
    return error.message;
  }

  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code: string }).code);

    switch (code) {
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
        return "Email or password is incorrect.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password is too weak. Use a stronger password.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      case "auth/popup-blocked":
        return "Pop-up blocked. Allow pop-ups and try again.";
      case "auth/popup-closed-by-user":
        return "Sign-in was canceled. Try again.";
      case "auth/cancelled-popup-request":
        return "Sign-in request canceled. Try again.";
      case "auth/account-exists-with-different-credential":
        return "Account exists with a different sign-in method.";
      case "auth/operation-not-allowed":
        return "This sign-in provider is not enabled yet.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/multi-factor-auth-required":
        return "Two-factor authentication is enabled for this account. Please complete sign-in in the Looped iOS app or contact support.";
      default:
        return "Unable to sign in. Please try again.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to sign in. Please try again.";
}

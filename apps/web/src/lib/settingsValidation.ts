export const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(normalizeUsername(value));
}

export function normalizeConfirmationPhrase(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isMatchingConfirmationPhrase(input: string, expected: string): boolean {
  return normalizeConfirmationPhrase(input) === normalizeConfirmationPhrase(expected);
}

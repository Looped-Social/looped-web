import type { Theme } from "@looped/ui";

import communityRequestDark from "@/assets/illustrations/community-request/dark.png";
import communityRequestLight from "@/assets/illustrations/community-request/light.png";
import kickoffDark from "@/assets/illustrations/kickoff/dark.png";
import kickoffLight from "@/assets/illustrations/kickoff/light.png";
import profileSetupDark from "@/assets/illustrations/profile-setup/dark.png";
import profileSetupLight from "@/assets/illustrations/profile-setup/light.png";
import requestConfirmDark from "@/assets/illustrations/request-confirm/dark.png";
import requestConfirmLight from "@/assets/illustrations/request-confirm/light.png";
import skipVerifyDark from "@/assets/illustrations/skip-verify/dark.png";
import skipVerifyLight from "@/assets/illustrations/skip-verify/light.png";
import verifiedConfirmDark from "@/assets/illustrations/verified-confirm/dark.png";
import verifiedConfirmLight from "@/assets/illustrations/verified-confirm/light.png";
import verifyFirstDark from "@/assets/illustrations/verify-first/dark.png";
import verifyFirstLight from "@/assets/illustrations/verify-first/light.png";
import verifyInfoDark from "@/assets/illustrations/verify-info/dark.png";
import verifyInfoLight from "@/assets/illustrations/verify-info/light.png";
import verifyWaitDark from "@/assets/illustrations/verify-wait/dark.png";
import verifyWaitLight from "@/assets/illustrations/verify-wait/light.png";

export type ThemedIllustration = {
  light: string;
  dark: string;
};

export const appIllustrations = {
  communityRequest: {
    light: communityRequestLight,
    dark: communityRequestDark,
  },
  kickoff: {
    light: kickoffLight,
    dark: kickoffDark,
  },
  profileSetup: {
    light: profileSetupLight,
    dark: profileSetupDark,
  },
  requestConfirm: {
    light: requestConfirmLight,
    dark: requestConfirmDark,
  },
  skipVerify: {
    light: skipVerifyLight,
    dark: skipVerifyDark,
  },
  verifiedConfirm: {
    light: verifiedConfirmLight,
    dark: verifiedConfirmDark,
  },
  verifyFirst: {
    light: verifyFirstLight,
    dark: verifyFirstDark,
  },
  verifyInfo: {
    light: verifyInfoLight,
    dark: verifyInfoDark,
  },
  verifyWait: {
    light: verifyWaitLight,
    dark: verifyWaitDark,
  },
} as const satisfies Record<string, ThemedIllustration>;

export function resolveIllustrationAsset(asset: ThemedIllustration, theme: Theme): string {
  return theme === "dark" ? asset.dark : asset.light;
}

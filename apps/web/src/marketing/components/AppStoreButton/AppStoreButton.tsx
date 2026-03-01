import appStoreDark from "@/assets/marketing/app-store/dark.svg";
import appStoreLight from "@/assets/marketing/app-store/light.svg";

const APP_STORE_URL = "https://apps.apple.com/us/app/looped-social/id6758413180";

type AppStoreButtonProps = {
  size?: number;
  className?: string;
};

export function AppStoreButton({ size = 6, className = "" }: AppStoreButtonProps) {
  const dimension = `${size}rem`;

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Download Looped Social on the App Store"
      className={`inline-block transition-opacity duration-150 hover:opacity-80 ${className}`}
      style={{ height: dimension }}
    >
      <img
        src={appStoreLight}
        alt="Download on the App Store"
        className="app-store-img-light block h-full w-auto"
      />
      <img
        src={appStoreDark}
        alt="Download on the App Store"
        className="app-store-img-dark hidden h-full w-auto"
      />
    </a>
  );
}

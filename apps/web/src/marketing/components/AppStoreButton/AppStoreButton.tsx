import appStoreDark from "@/assets/images/download-app-store-black.svg";
import appStoreLight from "@/assets/images/download-app-store-white.svg";

type AppStoreButtonProps = {
  size?: number;
  className?: string;
};

export function AppStoreButton({ size = 6, className = "" }: AppStoreButtonProps) {
  const dimension = `${size}rem`;

  return (
    <a
      href="#download"
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

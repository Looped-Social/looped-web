import './AppStoreButton.css'
import appStoreButtonBlack from '../../assets/images/download-app-store-black.svg'
import appStoreButtonWhite from '../../assets/images/download-app-store-white.svg'

interface AppStoreButtonProps {
  size?: number // Size in rem, default is 6
  className?: string
}

function AppStoreButton({ size = 6, className = '' }: AppStoreButtonProps) {
  return (
    <a
      href="#download"
      className={`app-store-button ${className}`}
      style={{ '--button-size': `${size}rem` } as React.CSSProperties}
    >
      <img
        src={appStoreButtonWhite}
        alt="Download on the App Store"
        className="app-store-button-light"
      />
      <img
        src={appStoreButtonBlack}
        alt="Download on the App Store"
        className="app-store-button-dark"
      />
    </a>
  )
}

export default AppStoreButton

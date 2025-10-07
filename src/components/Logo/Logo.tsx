import './Logo.css'
import mainLogo from '../../assets/images/brand-assets/main-logo.svg'

function Logo() {
  return (
    <div className="logo">
      <img src={mainLogo} alt="Looped" className="logo-image" />
      <span className="logo-text">ooped</span>
    </div>
  )
}

export default Logo

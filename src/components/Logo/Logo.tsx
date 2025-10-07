import { Link } from 'react-router'
import './Logo.css'
import mainLogo from '../../assets/images/brand-assets/main-logo.svg'

function Logo() {
  return (
    <Link to="/" className="logo">
      <img src={mainLogo} alt="Looped" className="logo-image" />
      <span className="logo-text">ooped</span>
    </Link>
  )
}

export default Logo

import './Navbar.css'
import logoLight from '../../assets/images/looped-logo/looped-logo-light.png'

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          <div className="navbar-logo">
            <img src={logoLight} alt="Looped" />
          </div>

          <ul className="navbar-links">
            <li><a href="#about">About</a></li>
            <li><a href="#fine-print">The Fine Print</a></li>
            <li><a href="#contact">Get in touch</a></li>
          </ul>
        </div>

        <div className="navbar-actions">
          <a href="#login" className="navbar-login">Log in</a>
          <a href="#get-looped" className="navbar-cta">Get Looped</a>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

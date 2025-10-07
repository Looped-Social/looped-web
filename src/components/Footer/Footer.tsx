import { Link } from 'react-router'
import './Footer.css'
import Logo from '../Logo/Logo'
import AppStoreButton from '../AppStoreButton/AppStoreButton'

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Brand Section */}
          <div className="footer-brand">
            <Logo />
            <p className="footer-tagline">
              Your community, verified. Where real employees and students speak freely.
            </p>
            <AppStoreButton size={2.5} className="footer-download" />
          </div>

          {/* Product Links */}
          <div className="footer-section">
            <h3 className="footer-title">Product</h3>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
              <li><a href="#download">Download</a></li>
            </ul>
          </div>

          {/* Company Links */}
          <div className="footer-section">
            <h3 className="footer-title">Company</h3>
            <ul className="footer-links">
              <li><a href="mailto:support@looped.app">Contact</a></li>
              <li><a href="https://twitter.com/loopedapp" target="_blank" rel="noopener noreferrer">Twitter</a></li>
              <li><a href="https://instagram.com/loopedapp" target="_blank" rel="noopener noreferrer">Instagram</a></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="footer-section">
            <h3 className="footer-title">Legal</h3>
            <ul className="footer-links">
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">© {currentYear} Looped, Inc. All rights reserved.</p>
          <p className="footer-note">iOS app only</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

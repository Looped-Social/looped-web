import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router'
import './Navbar.css'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import Logo from '../Logo/Logo'

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isFinePrintOpen, setIsFinePrintOpen] = useState(false)
  const [isFinePrintMobileOpen, setIsFinePrintMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFinePrintOpen(false)
      }
    }

    if (isFinePrintOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFinePrintOpen])

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
    setIsFinePrintMobileOpen(false)
  }

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-left">
          <Logo />

          <ul className="navbar-links">
            <li><Link to="/about">About</Link></li>
            <li className="navbar-dropdown" ref={dropdownRef}>
              <button
                className="navbar-dropdown-trigger"
                onClick={() => setIsFinePrintOpen(!isFinePrintOpen)}
                aria-expanded={isFinePrintOpen}
              >
                The Fine Print
                <svg
                  className={`dropdown-arrow ${isFinePrintOpen ? 'open' : ''}`}
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2 4 6 8 10 4" />
                </svg>
              </button>
              {isFinePrintOpen && (
                <div className="navbar-dropdown-menu">
                  <Link to="/community-rules" onClick={() => setIsFinePrintOpen(false)}>Community Rules</Link>
                  <Link to="/privacy" onClick={() => setIsFinePrintOpen(false)}>Privacy Policy</Link>
                  <Link to="/terms" onClick={() => setIsFinePrintOpen(false)}>Terms of Service</Link>
                  <Link to="/faq" onClick={() => setIsFinePrintOpen(false)}>FAQ</Link>
                </div>
              )}
            </li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>

        <div className="navbar-actions">
          <ThemeToggle />
          <Link to="/login" className="navbar-login">Log in</Link>
          <a href="#get-looped" className="navbar-cta">Get Looped</a>
        </div>

        {/* Hamburger Button */}
        <button
          className="navbar-hamburger"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger-line ${isMobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMobileMenuOpen ? 'open' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu}>
          <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="mobile-menu-close" onClick={closeMobileMenu}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <nav className="mobile-menu-nav">
              <Link to="/about" onClick={closeMobileMenu}>About</Link>
              <div className="mobile-menu-section">
                <button
                  className="mobile-menu-section-trigger"
                  onClick={() => setIsFinePrintMobileOpen(!isFinePrintMobileOpen)}
                  aria-expanded={isFinePrintMobileOpen}
                >
                  The Fine Print
                  <svg
                    className={`mobile-dropdown-arrow ${isFinePrintMobileOpen ? 'open' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2 4 6 8 10 4" />
                  </svg>
                </button>
                {isFinePrintMobileOpen && (
                  <div className="mobile-menu-subsection">
                    <Link to="/community-rules" onClick={closeMobileMenu}>Community Rules</Link>
                    <Link to="/privacy" onClick={closeMobileMenu}>Privacy Policy</Link>
                    <Link to="/terms" onClick={closeMobileMenu}>Terms of Service</Link>
                    <Link to="/faq" onClick={closeMobileMenu}>FAQ</Link>
                  </div>
                )}
              </div>
              <Link to="/contact" onClick={closeMobileMenu}>Contact</Link>
            </nav>

            <div className="mobile-menu-actions">
              <ThemeToggle />
              <Link to="/login" onClick={closeMobileMenu} className="mobile-menu-login">Log in</Link>
              <a href="#get-looped" onClick={closeMobileMenu} className="mobile-menu-cta">Get Looped</a>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar

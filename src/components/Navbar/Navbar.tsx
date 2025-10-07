import { useEffect, useState } from 'react'
import './Navbar.css'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import Logo from '../Logo/Logo'

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-left">
          <Logo />

          <ul className="navbar-links">
            <li><a href="#about">About</a></li>
            <li><a href="#fine-print">The Fine Print</a></li>
            <li><a href="#contact">Get in touch</a></li>
          </ul>
        </div>

        <div className="navbar-actions">
          <ThemeToggle />
          <a href="#login" className="navbar-login">Log in</a>
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
              <a href="#about" onClick={closeMobileMenu}>About</a>
              <a href="#fine-print" onClick={closeMobileMenu}>The Fine Print</a>
              <a href="#contact" onClick={closeMobileMenu}>Get in touch</a>
            </nav>

            <div className="mobile-menu-actions">
              <ThemeToggle />
              <a href="#login" onClick={closeMobileMenu} className="mobile-menu-login">Log in</a>
              <a href="#get-looped" onClick={closeMobileMenu} className="mobile-menu-cta">Get Looped</a>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar

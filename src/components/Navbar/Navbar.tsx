import { useEffect, useState } from 'react'
import './Navbar.css'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import mainLogo from '../../assets/images/brand-assets/main-logo.svg'

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-left">
          <div className="navbar-logo">
            <img src={mainLogo} alt="Looped" />
            <span className="navbar-logo-text">ooped</span>
          </div>

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
      </div>
    </nav>
  )
}

export default Navbar

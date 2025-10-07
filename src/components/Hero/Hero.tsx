import { useState, useEffect } from 'react'
import './Hero.css'
import phoneImage from '../../assets/images/home-page-sample.jpeg'
import AppStoreButton from '../AppStoreButton/AppStoreButton'

function Hero() {
  const words = ['community', 'workspace', 'college', 'colleagues', 'team', 'office']
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)

      setTimeout(() => {
        setCurrentWordIndex((prevIndex) => (prevIndex + 1) % words.length)
        setIsAnimating(false)
      }, 500) // Half of the animation duration for word switch
    }, 3000) // Change word every 3 seconds

    return () => clearInterval(interval)
  }, [words.length])

  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            <div>Your</div>
            <div>
              <span className={`rotating-word ${isAnimating ? 'fade-out' : 'fade-in'}`}>
                {words[currentWordIndex]}
              </span>,
            </div>
            <div className="hero-title-highlight">Verified.</div>
          </h1>
          <p className="hero-subtitle">
            Looped is where real employees and students speak freely, anonymous by design
          </p>
          <AppStoreButton size={6} className="hero-download" />
        </div>
        <div className="hero-image">
          <img src={phoneImage} alt="Looped App Interface" />
        </div>
      </div>
    </section>
  )
}

export default Hero

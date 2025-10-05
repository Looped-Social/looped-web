import './Hero.css'
import appStoreButton from '../../assets/images/download-app-store-black.svg'
import phoneImage from '../../assets/images/home-page-sample.jpeg'

function Hero() {
  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            <div>Your</div>
            <div>community,</div>
            <div className="hero-title-highlight">Verified.</div>
          </h1>
          <p className="hero-subtitle">
            Looped is where real employees and students speak freely, anonymous by design
          </p>
          <a href="#download" className="hero-download">
            <img src={appStoreButton} alt="Download on the App Store" />
          </a>
        </div>
        <div className="hero-image">
          <img src={phoneImage} alt="Looped App Interface" />
        </div>
      </div>
    </section>
  )
}

export default Hero

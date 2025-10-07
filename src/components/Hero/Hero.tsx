import './Hero.css'
import phoneImage from '../../assets/images/home-page-sample.jpeg'
import AppStoreButton from '../AppStoreButton/AppStoreButton'

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

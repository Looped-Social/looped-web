import './ComingSoon.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import Logo from '../../components/Logo/Logo'
import AppStoreButton from '../../components/AppStoreButton/AppStoreButton'

function ComingSoon() {
  return (
    <div className="page">
      <Navbar />
      <main className="coming-soon-page">
        <div className="coming-soon-container">
          <div className="coming-soon-logo">
            <Logo />
          </div>

          <h1 className="coming-soon-title">Looped on the Web</h1>
          <p className="coming-soon-subtitle">Coming Soon</p>

          <div className="coming-soon-content">
            <p className="coming-soon-text">
              We're working hard to bring Looped to the web. For now, you can experience Looped on iOS.
            </p>
            <p className="coming-soon-emphasis">
              Download the app to get started with your verified community today.
            </p>
          </div>

          <AppStoreButton size={3.5} className="coming-soon-download" />

          <div className="coming-soon-footer-note">
            <p>Want to be notified when we launch?</p>
            <a href="mailto:notify@looped.app" className="coming-soon-notify">
              Get Notified
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default ComingSoon

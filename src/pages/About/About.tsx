import './About.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import AppStoreButton from '../../components/AppStoreButton/AppStoreButton'

function About() {
  return (
    <div className="page">
      <Navbar />
      <main className="about-page">
        <div className="about-container">
          {/* Hero Section */}
          <div className="about-hero">
            <h1>Your workplace deserves a better conversation</h1>
            <p className="about-hero-subtitle">
              Looped is the workplace-verified social platform where employees and students can speak freely, connect authentically, and build real community.
            </p>
          </div>

          {/* Mission Section */}
          <section className="about-section">
            <h2>Why Looped Exists</h2>
            <p>
              Every workplace has a culture, but not every workplace has a voice. We built Looped because honest conversations matter—whether it's discussing workplace challenges, sharing wins, or simply connecting with colleagues who understand what you're going through.
            </p>
            <p>
              Traditional social media is too public. Internal chat tools are too formal. Anonymous forums lack accountability. Looped strikes the perfect balance: verified communities where you can be yourself without being identified.
            </p>
          </section>

          {/* How It Works */}
          <section className="about-section">
            <h2>How It Works</h2>
            <div className="about-steps">
              <div className="about-step">
                <div className="step-number">1</div>
                <h3>Verify Your Identity</h3>
                <p>Sign up with your work or school email. We verify you're part of the community, but your identity stays private to other users.</p>
              </div>
              <div className="about-step">
                <div className="step-number">2</div>
                <h3>Join Your Community</h3>
                <p>Connect with verified employees and students from your organization. Multiple companies? Join multiple communities.</p>
              </div>
              <div className="about-step">
                <div className="step-number">3</div>
                <h3>Speak Freely</h3>
                <p>Share thoughts, ask questions, and engage in authentic conversations without fear of judgment or professional consequences.</p>
              </div>
            </div>
          </section>

          {/* Values Section */}
          <section className="about-section">
            <h2>What We Stand For</h2>
            <div className="about-values">
              <div className="about-value">
                <h3>🔒 Privacy First</h3>
                <p>Your conversations are pseudonymous. Speak honestly without compromising your professional identity.</p>
              </div>
              <div className="about-value">
                <h3>✓ Verified Communities</h3>
                <p>Every member is verified. Know you're talking to real colleagues, not bots or outsiders.</p>
              </div>
              <div className="about-value">
                <h3>🛡️ Safe Spaces</h3>
                <p>Moderated communities with clear rules. We protect against harassment while preserving honest dialogue.</p>
              </div>
              <div className="about-value">
                <h3>💬 Authentic Voices</h3>
                <p>No corporate speak required. This is a space for real people having real conversations.</p>
              </div>
            </div>
          </section>

          {/* Team Section */}
          <section className="about-section">
            <h2>Built by People Who Get It</h2>
            <p>
              We're a small team that believes in the power of authentic workplace connections. We've experienced the frustration of having important conversations in hushed tones or not at all. We built Looped to change that.
            </p>
            <p>
              Based in San Francisco with a distributed team, we're backed by investors who believe in creating healthier, more transparent workplaces.
            </p>
          </section>

          {/* CTA Section */}
          <div className="about-cta">
            <h2>Ready to join your community?</h2>
            <p>Download Looped and start connecting with your verified workplace community today.</p>
            <AppStoreButton size={4} className="about-download" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default About

import './PrivacyPolicy.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'

function PrivacyPolicy() {
  return (
    <div className="page">
      <Navbar />
      <main className="legal-page">
        <div className="legal-container">
          <h1>Privacy Policy</h1>
          <p className="last-updated">Last updated: January 1, 2025</p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>
              Looped is committed to protecting your privacy. We collect only the information necessary to provide our workplace-verified social platform.
            </p>
            <h3>1.1 Account Information</h3>
            <p>
              When you create an account, we collect your work email address for employment verification purposes. Your identity remains pseudonymous to other users.
            </p>
            <h3>1.2 Usage Information</h3>
            <p>
              We collect information about how you interact with Looped, including posts, messages, and engagement with content.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Verify your employment or student status</li>
              <li>Provide and maintain the Looped platform</li>
              <li>Improve user experience and develop new features</li>
              <li>Ensure community safety and enforce our Terms of Service</li>
              <li>Send important updates about the service</li>
            </ul>
          </section>

          <section>
            <h2>3. Information Sharing</h2>
            <p>
              We do not sell your personal information. We may share information only in the following circumstances:
            </p>
            <ul>
              <li>With your consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect the rights and safety of Looped and our users</li>
              <li>With service providers who assist in operating our platform</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Request correction of your data</li>
              <li>Request deletion of your account</li>
              <li>Opt-out of certain data collection</li>
            </ul>
          </section>

          <section>
            <h2>6. Children's Privacy</h2>
            <p>
              Looped is not intended for users under 16 years of age. We do not knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any significant changes via email or through the app.
            </p>
          </section>

          <section>
            <h2>8. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@looped.app">privacy@looped.app</a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default PrivacyPolicy

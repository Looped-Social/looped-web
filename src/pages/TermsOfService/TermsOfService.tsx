import './TermsOfService.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'

function TermsOfService() {
  return (
    <div className="page">
      <Navbar />
      <main className="legal-page">
        <div className="legal-container">
          <h1>Terms of Service</h1>
          <p className="last-updated">Last updated: January 1, 2025</p>

          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Looped, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2>2. Eligibility</h2>
            <p>
              You must be at least 16 years old and employed or enrolled as a student at a verified institution to use Looped. By using the service, you represent that you meet these requirements.
            </p>
          </section>

          <section>
            <h2>3. Account Registration</h2>
            <p>
              To use Looped, you must create an account and verify your employment or student status. You are responsible for:
            </p>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2>4. User Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Post content that is illegal, harmful, threatening, or harassing</li>
              <li>Impersonate others or provide false information</li>
              <li>Violate the privacy or rights of others</li>
              <li>Attempt to gain unauthorized access to the service</li>
              <li>Use automated systems to access or scrape the service</li>
              <li>Post spam or engage in manipulative behavior</li>
            </ul>
          </section>

          <section>
            <h2>5. Content and Intellectual Property</h2>
            <h3>5.1 Your Content</h3>
            <p>
              You retain ownership of content you post on Looped. By posting, you grant us a license to use, modify, and display your content in connection with operating the service.
            </p>
            <h3>5.2 Our Content</h3>
            <p>
              The Looped platform, including its design, features, and branding, is owned by Looped, Inc. and protected by intellectual property laws.
            </p>
          </section>

          <section>
            <h2>6. Pseudonymity and Verification</h2>
            <p>
              Looped is a pseudonymous platform. While we verify your employment or student status, your identity is not revealed to other users. However, we reserve the right to disclose information if required by law or to protect our service and users.
            </p>
          </section>

          <section>
            <h2>7. Moderation and Enforcement</h2>
            <p>
              We reserve the right to remove content and suspend or terminate accounts that violate these Terms of Service. We may, but are not obligated to, monitor user content.
            </p>
          </section>

          <section>
            <h2>8. Disclaimers</h2>
            <p>
              Looped is provided "as is" without warranties of any kind. We do not guarantee that the service will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Looped, Inc. shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2>10. Changes to Terms</h2>
            <p>
              We may modify these Terms of Service at any time. Continued use of Looped after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2>11. Termination</h2>
            <p>
              You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms or for any other reason.
            </p>
          </section>

          <section>
            <h2>12. Governing Law</h2>
            <p>
              These Terms of Service are governed by the laws of the State of California, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2>13. Contact</h2>
            <p>
              For questions about these Terms of Service, contact us at{' '}
              <a href="mailto:legal@looped.app">legal@looped.app</a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default TermsOfService

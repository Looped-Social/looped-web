import './CommunityRules.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'

function CommunityRules() {
  return (
    <div className="page">
      <Navbar />
      <main className="legal-page">
        <div className="legal-container">
          <h1>Community Rules</h1>
          <p className="last-updated">Last updated: January 1, 2025</p>

          <section>
            <h2>1. Be Respectful</h2>
            <p>
              Looped is a workplace community built on mutual respect. Treat others as you would want to be treated in a professional environment.
            </p>
            <ul>
              <li>No harassment, bullying, or personal attacks</li>
              <li>Respect different viewpoints and perspectives</li>
              <li>Keep discussions constructive and professional</li>
              <li>No hate speech or discrimination of any kind</li>
            </ul>
          </section>

          <section>
            <h2>2. Maintain Pseudonymity</h2>
            <p>
              Looped is designed to be a pseudonymous platform. To protect everyone's privacy:
            </p>
            <ul>
              <li>Do not attempt to identify other users</li>
              <li>Do not share others' personal information</li>
              <li>Keep your own identity private if you choose to</li>
              <li>Report any attempts to dox or identify users</li>
            </ul>
          </section>

          <section>
            <h2>3. Keep Content Appropriate</h2>
            <p>
              Posts and messages should be workplace-appropriate. Remember that your coworkers are reading:
            </p>
            <ul>
              <li>No explicit sexual content or NSFW material</li>
              <li>No graphic violence or disturbing content</li>
              <li>No illegal activities or content</li>
              <li>Keep language and topics professional</li>
            </ul>
          </section>

          <section>
            <h2>4. No Spam or Self-Promotion</h2>
            <p>
              Looped is for genuine workplace conversations, not marketing or spam:
            </p>
            <ul>
              <li>No unsolicited advertising or promotions</li>
              <li>No repetitive or low-quality posts</li>
              <li>No pyramid schemes or MLM content</li>
              <li>Keep self-promotion minimal and relevant</li>
            </ul>
          </section>

          <section>
            <h2>5. Protect Company Confidentiality</h2>
            <p>
              While discussing workplace topics, be mindful of confidential information:
            </p>
            <ul>
              <li>Do not share trade secrets or proprietary information</li>
              <li>Respect NDAs and confidentiality agreements</li>
              <li>Avoid sharing sensitive company data</li>
              <li>Consider the impact of your posts on your employer</li>
            </ul>
          </section>

          <section>
            <h2>6. Be Honest and Authentic</h2>
            <p>
              Build trust within your workplace community by being genuine:
            </p>
            <ul>
              <li>Do not impersonate others</li>
              <li>Do not spread false information or rumors</li>
              <li>Verify claims before sharing</li>
              <li>Correct mistakes when you make them</li>
            </ul>
          </section>

          <section>
            <h2>7. Report Violations</h2>
            <p>
              Help keep Looped safe and welcoming:
            </p>
            <ul>
              <li>Report content that violates these rules</li>
              <li>Use the reporting tools, don't engage with rule-breakers</li>
              <li>Trust the moderation process</li>
              <li>Contact support for serious concerns</li>
            </ul>
          </section>

          <section>
            <h2>8. Consequences</h2>
            <p>
              Violations of these Community Rules may result in:
            </p>
            <ul>
              <li>Content removal</li>
              <li>Temporary account suspension</li>
              <li>Permanent account termination</li>
              <li>Reporting to employers or authorities in severe cases</li>
            </ul>
            <p>
              We review each case individually and consider context, severity, and history when taking action.
            </p>
          </section>

          <section>
            <h2>9. Contact Us</h2>
            <p>
              Questions about these Community Rules? Contact us at{' '}
              <a href="mailto:support@looped.app">support@looped.app</a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default CommunityRules

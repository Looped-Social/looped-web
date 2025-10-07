import { useState } from 'react'
import './FAQ.css'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'

interface FAQItemProps {
  question: string
  answer: string
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="faq-item">
      <button
        className={`faq-question ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{question}</span>
        <span className="faq-icon">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="faq-answer">
          <p>{answer}</p>
        </div>
      )}
    </div>
  )
}

function FAQ() {
  const faqs = [
    {
      question: "What is Looped?",
      answer: "Looped is a workplace-verified social iOS app where employees and students can connect and communicate pseudonymously within their company or school communities. Think of it as a safe space for honest workplace conversations."
    },
    {
      question: "How does verification work?",
      answer: "You verify your employment or student status using your work or school email address. Once verified, you can join your company or school's community on Looped while maintaining your pseudonymous identity."
    },
    {
      question: "Is Looped anonymous?",
      answer: "Looped is pseudonymous, not fully anonymous. While your real identity isn't revealed to other users, we verify your employment/student status and may disclose information if required by law or to protect our community."
    },
    {
      question: "Is Looped available on Android?",
      answer: "Currently, Looped is only available on iOS. We're focused on delivering the best experience for iPhone users first."
    },
    {
      question: "How do I download Looped?",
      answer: "You can download Looped from the App Store on your iPhone. Just search for 'Looped' or click the download button on our homepage."
    },
    {
      question: "Can I join multiple company communities?",
      answer: "Yes! If you're verified at multiple companies or schools, you can participate in all of their communities on Looped."
    },
    {
      question: "What kind of content is allowed?",
      answer: "We encourage honest workplace discussions, but content must not be illegal, harassing, threatening, or violate others' privacy. Please review our Terms of Service for full guidelines."
    },
    {
      question: "How do you handle harassment or inappropriate content?",
      answer: "We take community safety seriously. Users can report inappropriate content, and our moderation team reviews reports promptly. Accounts violating our Terms of Service may be suspended or terminated."
    },
    {
      question: "Can my employer see what I post?",
      answer: "Your posts are pseudonymous and not linked to your real identity within the app. However, we may disclose information if legally required to do so."
    },
    {
      question: "How do I delete my account?",
      answer: "You can delete your account at any time through the app settings. This action is permanent and will remove all your data from Looped."
    },
    {
      question: "Who can I contact for support?",
      answer: "For support inquiries, email us at support@looped.app. We typically respond within 24-48 hours."
    }
  ]

  return (
    <div className="page">
      <Navbar />
      <main className="faq-page">
        <div className="faq-container">
          <div className="faq-header">
            <h1>Frequently Asked Questions</h1>
            <p>Find answers to common questions about Looped</p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>

          <div className="faq-footer">
            <h3>Still have questions?</h3>
            <p>
              Can't find the answer you're looking for? Contact us at{' '}
              <a href="mailto:support@looped.app">support@looped.app</a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default FAQ

import './App.css'
import { useTheme } from './hooks/useTheme'
import PasswordGate from './components/PasswordGate/PasswordGate'
import Navbar from './components/Navbar/Navbar'
import Hero from './components/Hero/Hero'
import CompanyLogos from './components/CompanyLogos/CompanyLogos'
import Footer from './components/Footer/Footer'

function App() {
  // Initialize theme at app level
  useTheme()

  return (
    <PasswordGate>
      <div className="app">
        <Navbar />
        <main>
          <Hero />
          <CompanyLogos />
        </main>
        <Footer />
      </div>
    </PasswordGate>
  )
}

export default App

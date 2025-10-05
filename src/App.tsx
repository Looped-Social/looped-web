import './App.css'
import PasswordGate from './components/PasswordGate/PasswordGate'
import Navbar from './components/Navbar/Navbar'
import Hero from './components/Hero/Hero'
import CompanyLogos from './components/CompanyLogos/CompanyLogos'

function App() {
  return (
    <PasswordGate>
      <div className="app">
        <Navbar />
        <main>
          <Hero />
          <CompanyLogos />
        </main>
      </div>
    </PasswordGate>
  )
}

export default App

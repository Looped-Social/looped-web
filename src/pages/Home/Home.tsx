import './Home.css'
import Navbar from '../../components/Navbar/Navbar'
import Hero from '../../components/Hero/Hero'
import CompanyLogos from '../../components/CompanyLogos/CompanyLogos'
import Footer from '../../components/Footer/Footer'

function Home() {
  return (
    <div className="home-page">
      <Navbar />
      <main>
        <Hero />
        <CompanyLogos />
      </main>
      <Footer />
    </div>
  )
}

export default Home

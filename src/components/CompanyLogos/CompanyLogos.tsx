import './CompanyLogos.css'
import uncLogo from '../../assets/images/company-logos/unc.svg'
import ncstateLogo from '../../assets/images/company-logos/ncstate.png'
import googleLogo from '../../assets/images/company-logos/google.svg'
import jpmorganLogo from '../../assets/images/company-logos/jpmorgan.svg'
import walmartLogo from '../../assets/images/company-logos/walmart.svg'
import amazonLogo from '../../assets/images/company-logos/amazon.svg'

function CompanyLogos() {
  const logos = [
    { src: uncLogo, alt: 'University of North Carolina at Chapel Hill' },
    { src: ncstateLogo, alt: 'NC State University' },
    { src: googleLogo, alt: 'Google' },
    { src: jpmorganLogo, alt: 'J.P. Morgan' },
    { src: walmartLogo, alt: 'Walmart' },
    { src: amazonLogo, alt: 'Amazon' }
  ]

  return (
    <section className="company-logos">
      <div className="company-logos-container">
        <div className="company-logos-content">
          <p className="company-logos-title">Trusted by people everywhere</p>
          <div className="company-logos-scroll">
            <div className="company-logos-track">
              {logos.map((logo, index) => (
                <div key={index} className="company-logo-item">
                  <img src={logo.src} alt={logo.alt} />
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {logos.map((logo, index) => (
                <div key={`duplicate-${index}`} className="company-logo-item">
                  <img src={logo.src} alt={logo.alt} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CompanyLogos

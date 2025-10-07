import { createBrowserRouter } from 'react-router'
import App from './App.tsx'
import Home from './pages/Home/Home.tsx'
import About from './pages/About/About.tsx'
import Contact from './pages/Contact/Contact.tsx'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy.tsx'
import TermsOfService from './pages/TermsOfService/TermsOfService.tsx'
import CommunityRules from './pages/CommunityRules/CommunityRules.tsx'
import FAQ from './pages/FAQ/FAQ.tsx'
import ComingSoon from './pages/ComingSoon/ComingSoon.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'login',
        element: <ComingSoon />,
      },
      {
        path: 'about',
        element: <About />,
      },
      {
        path: 'contact',
        element: <Contact />,
      },
      {
        path: 'privacy',
        element: <PrivacyPolicy />,
      },
      {
        path: 'terms',
        element: <TermsOfService />,
      },
      {
        path: 'community-rules',
        element: <CommunityRules />,
      },
      {
        path: 'faq',
        element: <FAQ />,
      },
    ],
  },
])
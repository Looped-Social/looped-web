import { createBrowserRouter } from 'react-router'
import App from './App.tsx'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy.tsx'
import TermsOfService from './pages/TermsOfService/TermsOfService.tsx'
import FAQ from './pages/FAQ/FAQ.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/privacy',
    element: <PrivacyPolicy />,
  },
  {
    path: '/terms',
    element: <TermsOfService />,
  },
  {
    path: '/faq',
    element: <FAQ />,
  },
])
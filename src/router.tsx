import { createBrowserRouter } from 'react-router'
import App from './App.tsx'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy.tsx'
import TermsOfService from './pages/TermsOfService/TermsOfService.tsx'
import FAQ from './pages/FAQ/FAQ.tsx'
import ComingSoon from './pages/ComingSoon/ComingSoon.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/login',
    element: <ComingSoon />,
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
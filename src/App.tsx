import './App.css'
import { Outlet } from 'react-router'
import { useTheme } from './hooks/useTheme'
import PasswordGate from './components/PasswordGate/PasswordGate'

function App() {
  // Initialize theme at app level
  useTheme()

  return (
    <PasswordGate>
      <Outlet />
    </PasswordGate>
  )
}

export default App

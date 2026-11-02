import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initCustomValidation } from './utils/customValidation'
import { initSecurityShield } from './utils/securityShield'

// Initialize modern custom validation tooltip for all HTML5 form constraints
initCustomValidation()

// Initialize Anti-Inspect & DevTools Shield (active in production)
initSecurityShield()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


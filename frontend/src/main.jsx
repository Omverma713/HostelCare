import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initCustomValidation } from './utils/customValidation'

// Initialize modern custom validation tooltip for all HTML5 form constraints
initCustomValidation()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


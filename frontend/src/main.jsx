import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import './index.css'
import App from './App.jsx'
import { initCustomValidation } from './utils/customValidation'
import { initSecurityShield } from './utils/securityShield'

// 0. Notify Capgo CapacitorUpdater IMMEDIATELY upon boot to prevent auto-rollback watchdog
if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CapacitorUpdater')) {
  try {
    CapacitorUpdater.notifyAppReady().catch((err) => {
      console.warn('[main.jsx] notifyAppReady non-fatal:', err);
    });
  } catch (err) {
    console.warn('[main.jsx] notifyAppReady err:', err);
  }
}

// Initialize modern custom validation tooltip for all HTML5 form constraints
initCustomValidation()

// Initialize Anti-Inspect & DevTools Shield (active in production)
initSecurityShield()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


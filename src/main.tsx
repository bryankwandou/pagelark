import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import './styles/capture.css'
import './styles/tools.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support: cache the app shell after first load.
// Skipped inside the Android app: Capacitor already serves the bundled files offline,
// and a service worker would sit between the WebView and that local server.
const inNativeApp = 'Capacitor' in window
if ('serviceWorker' in navigator && import.meta.env.PROD && !inNativeApp) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

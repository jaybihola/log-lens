import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Harmless browser quirk triggered by ResizeObserver-based libraries (the
// virtualized log view's row measurement, CodeMirror) — not an actual bug,
// but Chrome fires it as a window 'error' event, which would otherwise pop
// Vite's dev error overlay for something that isn't broken.
window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

// If a new deploy is available, activate it and reload immediately instead
// of silently continuing to run the previously-cached version.
registerSW({ immediate: true, onNeedRefresh: () => window.location.reload() })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)

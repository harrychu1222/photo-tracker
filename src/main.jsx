import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { parseClientToken } from './lib/clientshare'
import './index.css'

// If a new deploy is available, activate it and reload immediately instead
// of silently continuing to run the previously-cached version.
registerSW({ immediate: true, onNeedRefresh: () => window.location.reload() })

// A client link (#c=...) opens the public progress page only: no login, no app code,
// and the signed-in app's Supabase client is never even created.
const clientToken = parseClientToken(window.location.hash)
const root = ReactDOM.createRoot(document.getElementById('root'))

const legal = window.location.hash === '#privacy' ? 'privacy' : window.location.hash === '#terms' ? 'terms' : null

if (legal) {
  import('./components/Legal/LegalPage.jsx').then(({ default: LegalPage }) => root.render(<LegalPage kind={legal} />))
} else if (clientToken) {
  import('./components/Client/ClientView.jsx').then(({ default: ClientView }) => root.render(<React.StrictMode><ClientView token={clientToken} /></React.StrictMode>))
} else {
  Promise.all([import('./App.jsx'), import('./context/AuthContext.jsx'), import('./context/WorkContext.jsx')]).then(([{ default: App }, { AuthProvider }, { WorkProvider }]) =>
    root.render(
      <React.StrictMode>
        <AuthProvider>
          <WorkProvider>
            <App />
          </WorkProvider>
        </AuthProvider>
      </React.StrictMode>
    )
  )
}

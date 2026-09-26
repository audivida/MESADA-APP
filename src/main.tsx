import React from 'react'
import ReactDOM from 'react-dom/client'
import { StoreProvider, useStore } from './app/store'
import { Toasts } from './components/ui'
import { Welcome } from './pages/Welcome'
import { Onboarding } from './pages/Onboarding'
import { ParentApp } from './pages/parent/ParentApp'
import { ChildApp } from './pages/child/ChildApp'
import './styles.css'

function App() {
  const { session, booting } = useStore()
  let screen
  if (booting) screen = <div className="loading">Carregando…</div>
  else if (!session) screen = <Welcome />
  else if (session.role === 'parent' && !session.familyId) screen = <Onboarding />
  else if (session.role === 'parent') screen = <ParentApp />
  else screen = <ChildApp />
  return (
    <>
      {screen}
      <Toasts />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/global.css'
import RootLayout from './Layout'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { captureWindowErrors } from './lib/logger'

captureWindowErrors()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RootLayout>
        <App />
      </RootLayout>
    </ErrorBoundary>
  </StrictMode>,
)

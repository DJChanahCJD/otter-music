import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RootLayout from './Layout'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RootLayout>
        <App />
      </RootLayout>
    </ErrorBoundary>
  </StrictMode>,
)

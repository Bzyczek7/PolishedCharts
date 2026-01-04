import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import AuthProvider from './contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: 'var(--toast-bg, #363636)',
          color: 'var(--toast-color, #fff)',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#fff',
          },
        },
      }}
    />
    <App />
  </AuthProvider>
)

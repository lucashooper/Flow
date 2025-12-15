import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Apply saved theme class to <html> before React renders
(() => {
  try {
    const theme = localStorage.getItem('theme') || 'default';
    const root = document.documentElement;
    // Remove any existing theme-* classes
    root.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) root.classList.remove(cls);
    });
    root.classList.add(`theme-${theme}`);
  } catch {}
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

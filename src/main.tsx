import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { isVaultMode } from './lib/platform'
import { installDesktopIntegrations } from './lib/desktop'
import { VaultOpenError } from './components/VaultOpenError'
import { UpdateToast } from './components/UpdateToast'
import { startAutoUpdateChecks } from './lib/updates'

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

async function start() {
  const root = createRoot(document.getElementById('root')!);
  installDesktopIntegrations();
  startAutoUpdateChecks();

  // Desktop app with a local vault: open it before anything reads data.
  if (isVaultMode()) {
    try {
      const { bootstrapVault } = await import('./lib/vault/bootstrap');
      await bootstrapVault();
    } catch (error) {
      console.error('Could not open vault:', error);
      root.render(<VaultOpenError error={error} />);
      return;
    }
  }

  root.render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <UpdateToast />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void start();

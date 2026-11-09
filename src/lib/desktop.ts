import { isDesktopApp } from './platform';

/**
 * Desktop-only behaviour: links to websites open in the user's browser
 * instead of trying to navigate the app window away.
 */
export function installDesktopIntegrations(): void {
  if (!isDesktopApp()) return;

  const openExternal = (url: string) => {
    void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(url)).catch((e) => {
      console.error('Could not open link', e);
    });
  };

  const isExternal = (href: string) => {
    try {
      const url = new URL(href, window.location.href);
      return /^(https?|mailto):$/.test(url.protocol) && url.origin !== window.location.origin;
    } catch {
      return false;
    }
  };

  document.addEventListener(
    'click',
    (e) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || !isExternal(anchor.href)) return;
      // In the editor, a plain click places the cursor; let the editor decide.
      if (anchor.closest('.ProseMirror[contenteditable="true"]') && !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      openExternal(anchor.href);
    },
    true,
  );

  const originalOpen = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const href = url ? String(url) : '';
    if (href && isExternal(href)) {
      openExternal(href);
      return null;
    }
    return originalOpen(url, target, features);
  };
}

/**
 * Desktop installers are built by .github/workflows/desktop-release.yml and
 * attached to GitHub Releases with fixed file names, so these links always
 * point at the newest version.
 */
const RELEASES = 'https://github.com/lucashooper/flow/releases';
const LATEST = `${RELEASES}/latest/download`;

export type DesktopOS = 'mac' | 'windows' | 'linux';

export const DESKTOP_DOWNLOADS: Record<DesktopOS, { label: string; file: string; url: string; note: string }> = {
  mac: {
    label: 'macOS',
    file: 'Flow-Notes-macOS.dmg',
    url: `${LATEST}/Flow-Notes-macOS.dmg`,
    note: 'Apple Silicon & Intel · macOS 10.15+',
  },
  windows: {
    label: 'Windows',
    file: 'Flow-Notes-Windows-Setup.exe',
    url: `${LATEST}/Flow-Notes-Windows-Setup.exe`,
    note: 'Windows 10 & 11 · 64-bit',
  },
  linux: {
    label: 'Linux',
    file: 'Flow-Notes-Linux.AppImage',
    url: `${LATEST}/Flow-Notes-Linux.AppImage`,
    note: 'AppImage · also as .deb',
  },
};

export const LINUX_DEB_URL = `${LATEST}/Flow-Notes-Linux.deb`;
export const ALL_RELEASES_URL = RELEASES;

export function detectDesktopOS(): DesktopOS | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return null;
  if (/Mac/i.test(ua)) return 'mac';
  if (/Win/i.test(ua)) return 'windows';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return null;
}

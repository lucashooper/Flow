import { Apple, Download, FolderLock, HardDrive, Monitor, RefreshCw, Terminal, WifiOff } from 'lucide-react';
import { ALL_RELEASES_URL, detectDesktopOS, DESKTOP_DOWNLOADS, LINUX_DEB_URL, type DesktopOS } from '../lib/downloads';

const ICONS: Record<DesktopOS, typeof Apple> = { mac: Apple, windows: Monitor, linux: Terminal };
const ORDER: DesktopOS[] = ['mac', 'windows', 'linux'];

/** Marketing-site section: download the desktop app. */
export function DesktopDownloadSection() {
  const detected = detectDesktopOS();
  const primary: DesktopOS = detected ?? 'mac';
  const others = ORDER.filter((os) => os !== primary);
  const PrimaryIcon = ICONS[primary];

  return (
    <section id="download" className="px-6" style={{ backgroundColor: '#0a0a0a', paddingTop: '8rem', paddingBottom: '8rem' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm uppercase tracking-[0.2em] mb-4" style={{ color: '#4fc3f7' }}>Desktop app</p>
          <h2 className="text-4xl md:text-5xl font-light mb-6" style={{ color: '#e5e5e5', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            Your notes, as files on your computer
          </h2>
          <p className="text-lg mx-auto" style={{ color: '#888888', lineHeight: 1.7, maxWidth: 640 }}>
            Flow for desktop can keep everything in a local vault: a plain folder where every note is its own file.
            No account, no cloud, and it works fully offline. Prefer syncing? Sign in to Flow Cloud instead.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mb-16">
          <a
            href={DESKTOP_DOWNLOADS[primary].url}
            className="inline-flex items-center gap-3 px-8 py-4 text-base font-medium text-white rounded-xl transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)', boxShadow: '0 8px 24px rgba(79, 195, 247, 0.3)' }}
          >
            <PrimaryIcon className="w-5 h-5" />
            Download for {DESKTOP_DOWNLOADS[primary].label}
          </a>
          <p className="text-sm" style={{ color: '#666666' }}>{DESKTOP_DOWNLOADS[primary].note} · Free</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {others.map((os) => {
              const Icon = ICONS[os];
              return (
                <a key={os} href={DESKTOP_DOWNLOADS[os].url} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: '#9a9a9a' }}>
                  <Icon className="w-4 h-4" /> {DESKTOP_DOWNLOADS[os].label}
                </a>
              );
            })}
            {primary === 'linux' || others.includes('linux') ? (
              <a href={LINUX_DEB_URL} className="hover:underline" style={{ color: '#9a9a9a' }}>.deb</a>
            ) : null}
            <a href={ALL_RELEASES_URL} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: '#9a9a9a' }}>
              All versions
            </a>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: HardDrive, title: 'Plain files', text: 'Each note is a file inside folders that match your dashboards.' },
            { icon: WifiOff, title: 'Works offline', text: 'Nothing to sign in to. Your notes never leave your computer.' },
            { icon: RefreshCw, title: 'Move it anywhere', text: 'Copy the folder to a new computer, or keep it in iCloud, Dropbox or OneDrive.' },
            { icon: FolderLock, title: 'You own it', text: 'Back it up like any folder. Bring your Flow Cloud notes across in one click.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="p-5 rounded-xl" style={{ backgroundColor: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <Icon className="w-5 h-5 mb-3" style={{ color: '#4fc3f7' }} />
              <h3 className="text-base font-medium mb-1" style={{ color: '#e5e5e5' }}>{title}</h3>
              <p className="text-sm" style={{ color: '#666666', lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>

        <details className="mt-10 mx-auto max-w-2xl text-sm rounded-xl px-5 py-4" style={{ backgroundColor: '#0f0f0f', border: '1px solid #1a1a1a', color: '#888888' }}>
          <summary className="cursor-pointer select-none flex items-center gap-2" style={{ color: '#bdbdbd' }}>
            <Download className="w-4 h-4" /> Opening Flow for the first time
          </summary>
          <div className="mt-3 space-y-2" style={{ lineHeight: 1.7 }}>
            <p>
              <strong style={{ color: '#d4d4d4' }}>Mac:</strong> open the .dmg and drag Flow Notes into Applications. The first time, right-click the app and
              choose <em>Open</em>. If macOS still blocks it, go to System Settings → Privacy &amp; Security and click <em>Open Anyway</em>.
            </p>
            <p>
              <strong style={{ color: '#d4d4d4' }}>Windows:</strong> if SmartScreen says "Windows protected your PC", click <em>More info</em> →{' '}
              <em>Run anyway</em>.
            </p>
            <p>These warnings appear because Flow isn't yet signed with a paid Apple / Microsoft developer certificate.</p>
          </div>
        </details>
      </div>
    </section>
  );
}

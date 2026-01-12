import { useState } from 'react';

const sections = ['Journal', 'Thoughts', 'Music', 'Projects'] as const;
type Section = (typeof sections)[number];

const journalEntries = [
  {
    date: '2025-11-12',
    title: 'Building Flow and chasing clarity',
    blurb: 'Notes on tools, thinking and building products that actually feel good to use.',
  },
];

const thoughts = [
  'Interfaces should feel more like calm studios, less like slot machines.',
];

const tracks = [
  {
    title: 'Orbit Intro',
    mood: 'Warm / Ambient',
    length: '2:31',
  },
];

const projects = [
  {
    name: 'Flow',
    tagline: 'A calm, modern workspace for deep thinking.',
    status: 'Active',
  },
];

export const App = () => {
  const [active, setActive] = useState<Section>('Journal');

  return (
    <div className="app-root">
      <div className="shell">
        <header className="shell-header">
          <div>
            <div className="logo-row">
              <div className="logo-dot" />
              <span className="logo-text">Lucas&apos;s Orbit</span>
            </div>
            <p className="logo-sub">A quiet place for notes, ideas and sound.</p>
          </div>

          <nav className="tabs" aria-label="Primary">
            {sections.map((section) => (
              <button
                key={section}
                type="button"
                className={section === active ? 'tab active' : 'tab'}
                onClick={() => setActive(section)}
              >
                {section}
              </button>
            ))}
          </nav>
        </header>

        <main className="shell-main">
          {active === 'Journal' && (
            <section className="panel" aria-label="Journal entries">
              <h2 className="panel-title">Journal</h2>
              <div className="panel-body list">
                {journalEntries.map((entry) => (
                  <article key={entry.title} className="list-item">
                    <div className="list-meta">{entry.date}</div>
                    <h3 className="list-title">{entry.title}</h3>
                    <p className="list-blurb">{entry.blurb}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {active === 'Thoughts' && (
            <section className="panel" aria-label="Thoughts">
              <h2 className="panel-title">Thoughts</h2>
              <div className="panel-body list">
                {thoughts.map((t) => (
                  <article key={t} className="list-item compact">
                    <p className="list-blurb">{t}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {active === 'Music' && (
            <section className="panel" aria-label="Music">
              <h2 className="panel-title">Music</h2>
              <p className="panel-sub">I&apos;ll drop mixes and tracks here over time.</p>
              <div className="panel-body list">
                {tracks.map((track) => (
                  <article key={track.title} className="list-item track">
                    <div>
                      <h3 className="list-title">{track.title}</h3>
                      <p className="list-blurb">{track.mood}</p>
                    </div>
                    <div className="track-meta">
                      <span className="badge">{track.length}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {active === 'Projects' && (
            <section className="panel" aria-label="Projects">
              <h2 className="panel-title">Projects</h2>
              <div className="panel-body grid">
                {projects.map((project) => (
                  <article key={project.name} className="card">
                    <h3 className="card-title">{project.name}</h3>
                    <p className="card-tagline">{project.tagline}</p>
                    <span className="badge subtle">{project.status}</span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>

        <footer className="shell-footer">
          <span>© {new Date().getFullYear()} Lucas.</span>
        </footer>
      </div>
    </div>
  );
};

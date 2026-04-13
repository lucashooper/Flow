import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const sections = [
  'Journal',
  'Thoughts',
  'Music',
  'Projects',
] as const;

type Section = (typeof sections)[number];
type JournalEntry = {
  id: string;
  created_at: string;
  title: string;
  body: string;
};
type Thought = {
  id: string;
  created_at: string;
  text: string;
};

type Track = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  length: string | null;
  audio_url: string | null;
  original_filename: string | null;
};

const projects = [
  {
    name: 'Flow',
    tagline: 'A calm, modern workspace for deep thinking.',
    status: 'Active',
  },
  {
    name: "Lucas's Orbit",
    tagline: 'A small corner of the internet for ideas, notes and music.',
    status: 'In progress',
  },
];

export const App = () => {
  const [active, setActive] = useState<Section>('Journal');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      const [journalRes, thoughtsRes, tracksRes] = await Promise.all([
        supabase
          .from('orbit_journal_entries')
          .select('id, created_at, title, body')
          .order('created_at', { ascending: false }),
        supabase
          .from('orbit_thoughts')
          .select('id, created_at, text')
          .order('created_at', { ascending: false }),
        supabase
          .from('orbit_tracks')
          .select('id, created_at, title, description, length, audio_url, original_filename')
          .order('created_at', { ascending: false }),
      ]);

      if (journalRes.error) {
        console.error(journalRes.error);
      } else {
        setJournalEntries(journalRes.data || []);
      }

      if (thoughtsRes.error) {
        console.error(thoughtsRes.error);
      } else {
        setThoughts(thoughtsRes.data || []);
      }

      if (tracksRes.error) {
        console.error(tracksRes.error);
      } else {
        setTracks(tracksRes.data || []);
      }
    };

    void loadAll();
  }, []);

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
                  <article key={entry.id} className="list-item">
                    <div className="list-meta">
                      {new Date(entry.created_at).toISOString().slice(0, 10)}
                    </div>
                    <h3 className="list-title">{entry.title}</h3>
                    <p className="list-blurb">{entry.body}</p>
                  </article>
                ))}
                {journalEntries.length === 0 && (
                  <article className="list-item compact">
                    <p className="list-blurb">No entries yet. Sign in at /admin to create one.</p>
                  </article>
                )}
              </div>
            </section>
          )}

          {active === 'Thoughts' && (
            <section className="panel" aria-label="Loose thoughts">
              <h2 className="panel-title">Thoughts</h2>
              <div className="panel-body list">
                {thoughts.map((t) => (
                  <article key={t.id} className="list-item compact">
                    <p className="list-blurb">{t.text}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {active === 'Music' && (
            <section className="panel" aria-label="Music">
              <h2 className="panel-title">Music</h2>
              <p className="panel-sub">
                A small catalog of tracks I&apos;ve made. I&apos;ll drop finished pieces and sketches here.
              </p>
              <div className="panel-body list">
                {tracks.map((track) => (
                  <article key={track.id} className="list-item track">
                    <div>
                      <h3 className="list-title">{track.title}</h3>
                      {track.description && (
                        <p className="list-blurb">{track.description}</p>
                      )}
                    </div>
                    <div className="track-meta">
                      {track.length && <span className="badge">{track.length}</span>}
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
          <span className="muted">Built with React &amp; Vite.</span>
        </footer>
      </div>
    </div>
  );
};

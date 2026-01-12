import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const OWNER_ID = 'f8d1da7f-b34c-4a80-b8f9-ab20f8af274c';

type AdminTab = 'Journal' | 'Thoughts' | 'Music' | 'Projects';

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

export const Admin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('Journal');

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [newThought, setNewThought] = useState('');

  const [tracks, setTracks] = useState<Track[]>([]);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackDescription, setNewTrackDescription] = useState('');
  const [newTrackLength, setNewTrackLength] = useState('');
  const [newTrackFile, setNewTrackFile] = useState<File | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (userId === OWNER_ID) {
      void Promise.all([fetchEntries(), fetchThoughts(), fetchTracks()]);
    }
  }, [userId]);

  const fetchEntries = async () => {
    const { data, error: fetchError } = await supabase
      .from('orbit_journal_entries')
      .select('id, created_at, title, body')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error(fetchError);
      setError('Failed to load entries');
      return;
    }

    setEntries(data || []);
  };

  const fetchThoughts = async () => {
    const { data, error: fetchError } = await supabase
      .from('orbit_thoughts')
      .select('id, created_at, text')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error(fetchError);
      setError('Failed to load thoughts');
      return;
    }

    setThoughts(data || []);
  };

  const fetchTracks = async () => {
    const { data, error: fetchError } = await supabase
      .from('orbit_tracks')
      .select('id, created_at, title, description, length, audio_url, original_filename')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error(fetchError);
      setError('Failed to load tracks');
      return;
    }

    setTracks(data || []);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      console.error(signInError);
      setError('Login failed');
      return;
    }

    if (data.user) {
      setUserId(data.user.id);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;

    const { error: insertError } = await supabase.from('orbit_journal_entries').insert({
      title: newTitle.trim(),
      body: newBody.trim(),
      is_published: true,
    });

    if (insertError) {
      console.error(insertError);
      setError('Failed to create entry');
      return;
    }

    setNewTitle('');
    setNewBody('');
    await fetchEntries();
  };

  const handleCreateThought = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThought.trim()) return;

    const { error: insertError } = await supabase.from('orbit_thoughts').insert({
      text: newThought.trim(),
    });

    if (insertError) {
      console.error(insertError);
      setError('Failed to create thought');
      return;
    }

    setNewThought('');
    await fetchThoughts();
  };

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let audioUrl: string | null = null;
    let originalFilename: string | null = null;

    if (newTrackFile) {
      const path = `tracks/${Date.now()}_${newTrackFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('orbit-media')
        .upload(path, newTrackFile);

      if (uploadError) {
        console.error(uploadError);
        setError('Failed to upload file');
        return;
      }

      const { data } = supabase.storage.from('orbit-media').getPublicUrl(path);
      audioUrl = data.publicUrl;
      originalFilename = newTrackFile.name;
    }

    // Use filename as title if title is empty
    const finalTitle = newTrackTitle.trim() || originalFilename || 'Untitled Track';

    const { error: insertError } = await supabase.from('orbit_tracks').insert({
      title: finalTitle,
      description: newTrackDescription.trim() || null,
      length: newTrackLength.trim() || null,
      audio_url: audioUrl,
      original_filename: originalFilename,
    });

    if (insertError) {
      console.error(insertError);
      setError('Failed to create track');
      return;
    }

    setNewTrackTitle('');
    setNewTrackDescription('');
    setNewTrackLength('');
    setNewTrackFile(null);
    await fetchTracks();
  };

  const handleDeleteEntry = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('orbit_journal_entries')
      .delete()
      .eq('id', id);
    if (deleteError) {
      console.error(deleteError);
      setError('Failed to delete entry');
      return;
    }
    await fetchEntries();
  };

  const handleDeleteThought = async (id: string) => {
    const { error: deleteError } = await supabase.from('orbit_thoughts').delete().eq('id', id);
    if (deleteError) {
      console.error(deleteError);
      setError('Failed to delete thought');
      return;
    }
    await fetchThoughts();
  };

  const handleDeleteTrack = async (id: string) => {
    const { error: deleteError } = await supabase.from('orbit_tracks').delete().eq('id', id);
    if (deleteError) {
      console.error(deleteError);
      setError('Failed to delete track');
      return;
    }
    await fetchTracks();
  };

  const isOwner = userId === OWNER_ID;

  return (
    <div className="app-root">
      <div className="shell">
        <header className="shell-header">
          <div>
            <div className="logo-row">
              <div className="logo-dot" />
              <span className="logo-text">Lucas&apos;s Orbit</span>
            </div>
            <p className="logo-sub">Admin · journal &amp; ideas.</p>
          </div>

          <nav className="tabs" aria-label="Admin">
            {(['Journal', 'Thoughts', 'Music', 'Projects'] as AdminTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={tab === activeTab ? 'tab active' : 'tab'}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>
        </header>

        <main className="shell-main">
          {!isOwner && (
            <section className="panel" aria-label="Admin login">
              <h2 className="panel-title">Sign in</h2>
              <p className="panel-sub">Use the same account you use for Flow.</p>
              <form onSubmit={handleLogin} className="panel-body list">
                <div className="list-item compact">
                  <label className="list-blurb">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{
                        display: 'block',
                        marginTop: 4,
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        font: 'inherit',
                      }}
                    />
                  </label>
                </div>
                <div className="list-item compact">
                  <label className="list-blurb">
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        display: 'block',
                        marginTop: 4,
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        font: 'inherit',
                      }}
                    />
                  </label>
                </div>
                {error && (
                  <div className="list-item compact">
                    <p className="list-blurb" style={{ color: '#b91c1c' }}>
                      {error}
                    </p>
                  </div>
                )}
                <div className="list-item compact">
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid #111827',
                      background: '#111827',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                    }}
                  >
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {isOwner && (
            <>
              {activeTab === 'Journal' && (
                <section className="panel" aria-label="Journal admin">
                  <h2 className="panel-title">Journal</h2>
                  <p className="panel-sub">Create and edit entries for Lucas&apos;s Orbit.</p>

                  <form onSubmit={handleCreateEntry} className="panel-body list">
                    <div className="list-item compact">
                      <input
                        type="text"
                        placeholder="Title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          font: 'inherit',
                        }}
                      />
                    </div>
                    <div className="list-item compact">
                      <textarea
                        placeholder="Body"
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        rows={5}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          font: 'inherit',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                    <div className="list-item compact">
                      <label className="list-blurb" style={{ display: 'block' }}>
                        Audio / project file
                        <input
                          type="file"
                          accept=".wav,.mp3,.flac,.ogg,.m4a,.flp,.zip"
                          onChange={(e) => setNewTrackFile(e.target.files?.[0] ?? null)}
                          style={{
                            display: 'block',
                            marginTop: 4,
                            fontSize: '0.8rem',
                          }}
                        />
                      </label>
                    </div>
                    <div className="list-item compact">
                      <button
                        type="submit"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: '1px solid #111827',
                          background: '#111827',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                        }}
                      >
                        Publish entry
                      </button>
                    </div>
                  </form>

                  <div className="panel-body list">
                    {entries.map((entry) => (
                      <article key={entry.id} className="list-item">
                        <div className="list-meta">
                          {new Date(entry.created_at).toISOString().slice(0, 10)}
                        </div>
                        <h3 className="list-title">{entry.title}</h3>
                        <p className="list-blurb">{entry.body}</p>
                        <button
                          type="button"
                          style={{
                            marginTop: 4,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            fontSize: '0.75rem',
                            color: '#b91c1c',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
                    {entries.length === 0 && (
                      <div className="list-item compact">
                        <p className="list-blurb">No entries yet. Create your first one above.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'Thoughts' && (
                <section className="panel" aria-label="Thoughts admin">
                  <h2 className="panel-title">Thoughts</h2>
                  <p className="panel-sub">Short lines of text that appear on the Thoughts tab.</p>

                  <form onSubmit={handleCreateThought} className="panel-body list">
                    <div className="list-item compact">
                      <textarea
                        placeholder="New thought"
                        value={newThought}
                        onChange={(e) => setNewThought(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          font: 'inherit',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                    <div className="list-item compact">
                      <button
                        type="submit"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: '1px solid #111827',
                          background: '#111827',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                        }}
                      >
                        Add thought
                      </button>
                    </div>
                  </form>

                  <div className="panel-body list">
                    {thoughts.map((t) => (
                      <article key={t.id} className="list-item compact">
                        <p className="list-blurb">{t.text}</p>
                        <button
                          type="button"
                          style={{
                            marginTop: 4,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            fontSize: '0.75rem',
                            color: '#b91c1c',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDeleteThought(t.id)}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
                    {thoughts.length === 0 && (
                      <div className="list-item compact">
                        <p className="list-blurb">No thoughts yet. Add one above.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'Music' && (
                <section className="panel" aria-label="Music admin">
                  <h2 className="panel-title">Music</h2>
                  <p className="panel-sub">Add tracks with a short description and length.</p>

                  <form onSubmit={handleCreateTrack} className="panel-body list">
                    <div className="list-item compact">
                      <input
                        type="text"
                        placeholder="Title"
                        value={newTrackTitle}
                        onChange={(e) => setNewTrackTitle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          font: 'inherit',
                        }}
                      />
                    </div>
                    <div className="list-item compact">
                      <input
                        type="text"
                        placeholder="Description / mood"
                        value={newTrackDescription}
                        onChange={(e) => setNewTrackDescription(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          font: 'inherit',
                        }}
                      />
                    </div>
                    <div className="list-item compact">
                      <input
                        type="text"
                        placeholder="Length (e.g. 3:47)"
                        value={newTrackLength}
                        onChange={(e) => setNewTrackLength(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          font: 'inherit',
                        }}
                      />
                    </div>
                    <div className="list-item compact">
                      <label className="list-blurb" style={{ display: 'block' }}>
                        Audio / project file
                        <input
                          type="file"
                          accept=".wav,.mp3,.flac,.ogg,.m4a,.flp,.zip"
                          onChange={(e) => setNewTrackFile(e.target.files?.[0] ?? null)}
                          style={{
                            display: 'block',
                            marginTop: 4,
                            fontSize: '0.8rem',
                          }}
                        />
                      </label>
                    </div>
                    <div className="list-item compact">
                      <button
                        type="submit"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: '1px solid #111827',
                          background: '#111827',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'transform 80ms ease, opacity 80ms ease',
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'scale(0.97)';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        Add track
                      </button>
                    </div>
                  </form>

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
                          {track.audio_url && (
                            <a
                              href={track.audio_url}
                              target="_blank"
                              rel="noreferrer"
                              className="list-blurb"
                              style={{ fontSize: '0.78rem' }}
                            >
                              {track.original_filename || 'Open file'}
                            </a>
                          )}
                          <button
                            type="button"
                            style={{
                              padding: 0,
                              border: 'none',
                              background: 'transparent',
                              fontSize: '0.75rem',
                              color: '#b91c1c',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleDeleteTrack(track.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                    {tracks.length === 0 && (
                      <div className="list-item compact">
                        <p className="list-blurb">No tracks yet. Add one above.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'Projects' && (
                <section className="panel" aria-label="Projects admin">
                  <h2 className="panel-title">Projects</h2>
                  <p className="panel-sub">
                    For now projects are edited in code. We can move these into the database later if you
                    want a full UI.
                  </p>
                </section>
              )}
            </>
          )}
        </main>

        <footer className="shell-footer">
          <span>© {new Date().getFullYear()} Lucas.</span>
        </footer>
      </div>
    </div>
  );
}

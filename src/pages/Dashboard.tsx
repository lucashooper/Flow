import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Note } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Navbar } from '../components/Navbar';

export const Dashboard = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewNote = async () => {
    if (!user?.id) {
      alert('You must be logged in to create notes');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{ 
          title: 'Untitled Note', 
          content: '',
          user_id: user.id 
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating note:', error);
        alert(`Failed to create note: ${error.message}. Make sure you've set up the database tables.`);
        return;
      }
      
      if (data) {
        navigate(`/notes/${data.id}`);
      }
    } catch (error: any) {
      console.error('Error creating note:', error);
      alert(`Failed to create note: ${error.message}`);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Notes</h1>
          <Button onClick={createNewNote}>
            <Plus className="w-5 h-5 mr-2" />
            New Note
          </Button>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Loading notes...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery ? 'No notes found' : 'No notes yet. Create your first note!'}
            </p>
            {!searchQuery && (
              <Button onClick={createNewNote}>
                <Plus className="w-5 h-5 mr-2" />
                Create Note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => (
              <Card key={note.id} onClick={() => navigate(`/notes/${note.id}`)}>
                <h3 className="text-lg font-semibold mb-2 truncate">{note.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
                  {note.content || 'Empty note'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Updated {formatDate(note.updated_at)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

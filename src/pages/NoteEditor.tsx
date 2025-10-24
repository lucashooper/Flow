import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Note } from '../types';
import { Button } from '../components/Button';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { Navbar } from '../components/Navbar';

export const NoteEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchNote();
    }
  }, [id]);

  const fetchNote = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!id) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('notes')
        .update({ 
          title: title || 'Untitled Note', 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async () => {
    if (!id || !confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    const timer = setTimeout(() => {
      if (note && (title !== note.title || content !== note.content)) {
        saveNote();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, content]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading note...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          
          <div className="flex gap-2 items-center">
            {saving && <span className="text-sm text-gray-500">Saving...</span>}
            <Button variant="ghost" onClick={saveNote}>
              <Save className="w-5 h-5 mr-2" />
              Save
            </Button>
            <Button variant="ghost" onClick={deleteNote}>
              <Trash2 className="w-5 h-5 text-red-600" />
            </Button>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="text-3xl font-bold mb-6 bg-transparent border-none focus:outline-none"
        />

        <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Start writing your note..."
          />
        </div>
      </div>
    </div>
  );
};

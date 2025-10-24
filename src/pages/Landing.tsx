import { useNavigate } from 'react-router-dom';
import { FileText, Lock, Zap } from 'lucide-react';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

export const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <FileText className="w-12 h-12 text-blue-600" />
          <h1 className="text-5xl font-bold">Quill Notes</h1>
        </div>
        
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-12">
          A beautiful, minimal note-taking app with markdown support
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="p-6">
            <FileText className="w-10 h-10 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Markdown Support</h3>
            <p className="text-gray-600 dark:text-gray-400">Write notes with full markdown formatting</p>
          </div>
          <div className="p-6">
            <Lock className="w-10 h-10 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Secure & Private</h3>
            <p className="text-gray-600 dark:text-gray-400">Your notes are encrypted and secure</p>
          </div>
          <div className="p-6">
            <Zap className="w-10 h-10 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Fast & Simple</h3>
            <p className="text-gray-600 dark:text-gray-400">Lightning-fast and easy to use</p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate('/signup')}>Get Started</Button>
          <Button variant="secondary" onClick={() => navigate('/login')}>Sign In</Button>
        </div>
      </div>
    </div>
  );
};

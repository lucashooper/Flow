import { useNavigate } from 'react-router-dom';
import { FileText, Lock, Zap, Focus, Download, CheckCircle, ArrowRight } from 'lucide-react';
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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b" style={{ 
        backgroundColor: 'rgba(10, 10, 10, 0.8)', 
        backdropFilter: 'blur(12px)',
        borderColor: '#1a1a1a'
      }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img 
              src="/FlowIcon-Main.png" 
              alt="Flow" 
              className="w-8 h-8"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(79, 195, 247, 0.3))' }}
            />
            <span className="text-xl font-semibold" style={{ color: '#e5e5e5' }}>Flow</span>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => scrollToSection('features')}
              className="text-sm transition-colors hover:text-[#4fc3f7]" 
              style={{ color: '#888888' }}
            >
              Features
            </button>
            <button 
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm transition-colors hover:text-[#4fc3f7]" 
              style={{ color: '#888888' }}
            >
              How it works
            </button>
            <button 
              onClick={() => scrollToSection('pricing')}
              className="text-sm transition-colors hover:text-[#4fc3f7]" 
              style={{ color: '#888888' }}
            >
              Pricing
            </button>
            <button 
              onClick={() => scrollToSection('security')}
              className="text-sm transition-colors hover:text-[#4fc3f7]" 
              style={{ color: '#888888' }}
            >
              Security
            </button>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium transition-colors rounded-lg"
              style={{ color: '#888888' }}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)',
                boxShadow: '0 4px 12px rgba(79, 195, 247, 0.3)',
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center mb-20">
            {/* Headline */}
            <h1 
              className="text-6xl md:text-7xl font-light mb-8 leading-tight"
              style={{ 
                color: '#e5e5e5',
                letterSpacing: '-0.02em',
                lineHeight: '1.1'
              }}
            >
              A calm space for thinking and writing
            </h1>
            
            {/* Subheadline */}
            <p className="text-xl md:text-2xl mb-12" style={{ 
              color: '#888888',
              lineHeight: '1.6',
              maxWidth: '700px',
              margin: '0 auto 3rem'
            }}>
              Flow helps you achieve deep focus and clarity for long-form thinking, without distractions.
            </p>

            {/* CTAs */}
            <div className="flex gap-4 justify-center mb-20">
              <button
                onClick={() => navigate('/signup')}
                className="px-8 py-4 text-base font-medium text-white rounded-xl transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)',
                  boxShadow: '0 8px 24px rgba(79, 195, 247, 0.3)',
                }}
              >
                Get Started
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 text-base font-medium rounded-xl transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  color: '#e5e5e5',
                }}
              >
                Sign in
              </button>
            </div>
          </div>

          {/* Premium Screenshot */}
          <div className="max-w-6xl mx-auto">
            <div 
              className="rounded-2xl overflow-hidden"
              style={{
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(79, 195, 247, 0.2)',
                border: '1px solid #1a1a1a',
              }}
            >
              <img 
                src="/website-images/Flow-Notes-Main.png" 
                alt="Flow Notes Interface" 
                className="w-full"
                style={{ display: 'block' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-light text-center mb-16" style={{ color: '#e5e5e5' }}>
            Built for deep work
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="p-6 rounded-xl" style={{ backgroundColor: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <FileText className="w-6 h-6 mb-4" style={{ color: '#4fc3f7' }} />
              <h3 className="text-base font-medium mb-2" style={{ color: '#e5e5e5' }}>Markdown</h3>
              <p className="text-sm" style={{ color: '#666666' }}>Full formatting support</p>
            </div>
            
            <div className="p-6 rounded-xl" style={{ backgroundColor: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <Lock className="w-6 h-6 mb-4" style={{ color: '#4fc3f7' }} />
              <h3 className="text-base font-medium mb-2" style={{ color: '#e5e5e5' }}>Private</h3>
              <p className="text-sm" style={{ color: '#666666' }}>Encrypted notes</p>
            </div>
            
            <div className="p-6 rounded-xl" style={{ backgroundColor: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <Zap className="w-6 h-6 mb-4" style={{ color: '#4fc3f7' }} />
              <h3 className="text-base font-medium mb-2" style={{ color: '#e5e5e5' }}>Fast</h3>
              <p className="text-sm" style={{ color: '#666666' }}>Lightning performance</p>
            </div>
            
            <div className="p-6 rounded-xl" style={{ backgroundColor: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <Focus className="w-6 h-6 mb-4" style={{ color: '#4fc3f7' }} />
              <h3 className="text-base font-medium mb-2" style={{ color: '#e5e5e5' }}>Focus</h3>
              <p className="text-sm" style={{ color: '#666666' }}>Distraction-free</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-light text-center mb-20" style={{ color: '#e5e5e5' }}>How it works</h2>
          
          <div className="space-y-16">
            <div className="flex items-start gap-8">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <span className="text-lg font-medium" style={{ color: '#4fc3f7' }}>1</span>
              </div>
              <div>
                <h3 className="text-2xl font-light mb-3" style={{ color: '#e5e5e5' }}>Create your space</h3>
                <p className="text-lg" style={{ color: '#666666', lineHeight: '1.7' }}>Sign up and start writing immediately. No setup required.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-8">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <span className="text-lg font-medium" style={{ color: '#4fc3f7' }}>2</span>
              </div>
              <div>
                <h3 className="text-2xl font-light mb-3" style={{ color: '#e5e5e5' }}>Write without distraction</h3>
                <p className="text-lg" style={{ color: '#666666', lineHeight: '1.7' }}>Focus mode dims everything except your current note.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-8">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <span className="text-lg font-medium" style={{ color: '#4fc3f7' }}>3</span>
              </div>
              <div>
                <h3 className="text-2xl font-light mb-3" style={{ color: '#e5e5e5' }}>Organize naturally</h3>
                <p className="text-lg" style={{ color: '#666666', lineHeight: '1.7' }}>Folders, tags, and search help you find what you need.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing/Beta */}
      <section id="pricing" className="py-24 px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-light mb-6" style={{ color: '#e5e5e5' }}>Free while in beta</h2>
          <p className="text-xl mb-12" style={{ color: '#666666', lineHeight: '1.7' }}>
            Flow is currently free to use. We're focused on building the best writing experience possible.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="px-8 py-4 text-base font-medium text-white rounded-xl transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)',
              boxShadow: '0 8px 24px rgba(79, 195, 247, 0.3)',
            }}
          >
            Get Started
          </button>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-light text-center mb-16" style={{ color: '#e5e5e5' }}>Your data is secure</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
                <Lock className="w-6 h-6" style={{ color: '#4fc3f7' }} />
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: '#e5e5e5' }}>End-to-end encryption</h3>
              <p className="text-sm" style={{ color: '#666666' }}>Your notes are encrypted at rest</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
                <CheckCircle className="w-6 h-6" style={{ color: '#4fc3f7' }} />
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: '#e5e5e5' }}>Regular backups</h3>
              <p className="text-sm" style={{ color: '#666666' }}>Automatic daily backups</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
                <Download className="w-6 h-6" style={{ color: '#4fc3f7' }} />
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: '#e5e5e5' }}>Export anytime</h3>
              <p className="text-sm" style={{ color: '#666666' }}>Download all your notes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6" style={{ backgroundColor: '#0f0f0f' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-light mb-6" style={{ color: '#e5e5e5', lineHeight: '1.2' }}>
            Start writing with clarity
          </h2>
          <p className="text-xl mb-12" style={{ color: '#666666' }}>
            Join Flow and experience focused, distraction-free writing.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="px-10 py-5 text-lg font-medium text-white rounded-xl transition-all hover:scale-[1.02] inline-flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)',
              boxShadow: '0 8px 24px rgba(79, 195, 247, 0.3)',
            }}
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t" style={{ backgroundColor: '#0a0a0a', borderColor: '#1a1a1a' }}>
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm" style={{ color: '#666666' }}>© 2024 Flow. Built for deep work.</p>
        </div>
      </footer>
    </div>
  );
};

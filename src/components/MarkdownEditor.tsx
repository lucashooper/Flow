import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const MarkdownEditor = ({ value, onChange, placeholder }: MarkdownEditorProps) => {
  const [isPreview, setIsPreview] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-8 py-3 border-b border-[#2a2a2a]">
        <button
          onClick={() => setIsPreview(false)}
          className={`px-4 py-1.5 rounded text-sm transition-colors ${
            !isPreview 
              ? 'bg-[#A0522D] text-white' 
              : 'text-[#888888] hover:bg-[#1a1a1a] hover:text-[#e5e5e5]'
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setIsPreview(true)}
          className={`px-4 py-1.5 rounded text-sm transition-colors ${
            isPreview 
              ? 'bg-[#A0522D] text-white' 
              : 'text-[#888888] hover:bg-[#1a1a1a] hover:text-[#e5e5e5]'
          }`}
        >
          Preview
        </button>
      </div>

      {isPreview ? (
        <div className="flex-1 overflow-auto prose prose-invert max-w-none p-8 custom-scrollbar">
          <ReactMarkdown>{value || '*No content*'}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 w-full px-8 py-6 resize-none bg-transparent text-[#e5e5e5] placeholder-[#666666] focus:outline-none leading-relaxed custom-scrollbar"
          style={{ fontSize: '15px', lineHeight: '1.7' }}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0a0a0a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2a2a;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3a3a3a;
        }
        
        .prose {
          color: #e5e5e5;
        }
        .prose h1 {
          color: #e5e5e5;
          border-bottom: 1px solid #2a2a2a;
        }
        .prose h2 {
          color: #e5e5e5;
        }
        .prose h3 {
          color: #e5e5e5;
        }
        .prose a {
          color: #D97706;
        }
        .prose code {
          color: #e5e5e5;
          background: #1a1a1a;
        }
        .prose pre {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
        }
        .prose blockquote {
          border-left-color: #A0522D;
          color: #888888;
        }
      `}</style>
    </div>
  );
};

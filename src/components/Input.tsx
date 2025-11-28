import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = ({ label, className = '', ...props }: InputProps) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-2" style={{ color: '#e5e5e5' }}>{label}</label>}
      <input
        className={`w-full px-4 py-3 rounded-xl transition-all duration-200 ${className}`}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#e5e5e5',
          outline: 'none'
        }}
        onFocus={(e) => {
          e.target.style.border = '1px solid rgba(255, 122, 24, 0.5)';
          e.target.style.boxShadow = '0 0 0 3px rgba(255, 122, 24, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.border = '1px solid rgba(255, 255, 255, 0.1)';
          e.target.style.boxShadow = 'none';
        }}
        {...props}
      />
    </div>
  );
};

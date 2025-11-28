import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const PasswordInput = ({ label, className = '', ...props }: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-2" style={{ color: '#e5e5e5' }}>{label}</label>}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          className={`w-full px-4 py-3 pr-12 rounded-xl transition-all duration-200 ${className}`}
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
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: '#888888' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ff7a18'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

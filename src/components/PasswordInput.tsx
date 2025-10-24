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
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          className={`w-full px-4 py-2 pr-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
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

import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export const Button = ({ variant = 'primary', children, className = '', ...props }: ButtonProps) => {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
  };

  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

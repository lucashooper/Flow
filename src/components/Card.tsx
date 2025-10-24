interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card = ({ children, className = '', onClick }: CardProps) => {
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800 p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

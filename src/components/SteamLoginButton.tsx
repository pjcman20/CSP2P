import { useState } from 'react';
import { Button } from './ui/button';

interface SteamLoginButtonProps {
  onLogin: () => void;
  className?: string;
}

export function SteamLoginButton({ onLogin, className = '' }: SteamLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onLogin();
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className={`bg-black hover:bg-gray-900 text-white border border-gray-700 ${className}`}
      size="lg"
    >
      <svg
        className="w-5 h-5 mr-2"
        viewBox="0 0 256 256"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M127.999 0C57.421 0 0 57.421 0 127.999c0 53.382 32.808 99.083 79.362 117.963l26.688-55.039c-8.28-4.173-13.989-12.653-13.989-22.447 0-13.894 11.278-25.172 25.172-25.172 1.941 0 3.828.222 5.649.638l28.101-40.688c-11.081-7.443-18.377-20.048-18.377-34.377 0-22.825 18.514-41.339 41.339-41.339s41.339 18.514 41.339 41.339c0 22.825-18.514 41.339-41.339 41.339-.339 0-.675-.01-1.012-.022l-40.264 28.723c.329 1.705.506 3.467.506 5.271 0 4.565-1.219 8.846-3.345 12.542l55.345 26.453C220.685 214.197 256 174.664 256 127.999 256 57.421 198.579 0 127.999 0zm47.946 89.628c-14.862 0-26.934-12.072-26.934-26.934s12.072-26.934 26.934-26.934 26.934 12.072 26.934 26.934-12.072 26.934-26.934 26.934zm-58.099 98.566c-8.759 0-15.868-7.109-15.868-15.868s7.109-15.868 15.868-15.868 15.868 7.109 15.868 15.868-7.109 15.868-15.868 15.868z" />
      </svg>
      {isLoading ? 'Connecting...' : 'Sign in with Steam'}
    </Button>
  );
}

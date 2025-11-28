import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface CS2ItemImageProps {
  src: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * CS2 Item Image Component with fallback handling
 * Handles Steam CDN CORS issues and broken images gracefully
 */
export function CS2ItemImage({ src, alt, className = '', size = 'md' }: CS2ItemImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const handleError = () => {
    console.warn(`Failed to load image: ${src}`);
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
  };

  // Fallback UI when image fails to load
  if (error) {
    return (
      <div 
        className={`${sizeClasses[size]} ${className} flex items-center justify-center bg-[#1a1f2e] border border-gray-700 rounded`}
        title={alt}
      >
        <Package className="w-1/2 h-1/2 text-gray-600" />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1f2e] border border-gray-700 rounded animate-pulse">
          <Package className="w-1/2 h-1/2 text-gray-600" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onError={handleError}
        onLoad={handleLoad}
        crossOrigin="anonymous"
        className={`${sizeClasses[size]} object-contain ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        loading="lazy"
      />
    </div>
  );
}

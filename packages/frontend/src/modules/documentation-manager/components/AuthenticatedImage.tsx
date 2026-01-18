/**
 * Authenticated Image Component
 * Displays images that require authentication by fetching them with auth headers
 * and converting to blob URLs
 */

import { useState, useEffect } from 'react';

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function AuthenticatedImage({ src, alt, className }: AuthenticatedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(false);

        const token = localStorage.getItem('accessToken');
        const response = await fetch(src, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load image');
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setLoading(false);
      } catch (err) {
        console.error('Error loading authenticated image:', err);
        setError(true);
        setLoading(false);
      }
    };

    fetchImage();

    // Cleanup blob URL when component unmounts
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-xs text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-xs text-gray-400">Failed to load</div>
        </div>
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} />;
}

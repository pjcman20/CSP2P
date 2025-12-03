import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { processSteamCallback } from '../utils/steamAuth';

interface SteamCallbackProps {
  onComplete: () => void;
}

export default function SteamCallback({ onComplete }: SteamCallbackProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('=== STEAM CALLBACK: Component mounted ===');
        console.log('STEAM CALLBACK: Current URL:', window.location.href);
        console.log('STEAM CALLBACK: Pathname:', window.location.pathname);
        console.log('STEAM CALLBACK: Search:', window.location.search);
        
        // Get all query parameters from URL
        const queryParams = new URLSearchParams(window.location.search);
        
        console.log('STEAM CALLBACK: Query params count:', queryParams.size);
        console.log('STEAM CALLBACK: Query params:', Array.from(queryParams.entries()));
        
        // Verify this is a Steam callback
        if (!queryParams.has('openid.claimed_id')) {
          console.error('STEAM CALLBACK: No openid.claimed_id found in query params');
          console.error('STEAM CALLBACK: Available params:', Array.from(queryParams.keys()));
          setError('Invalid Steam callback - missing OpenID data');
          setTimeout(onComplete, 3000);
          return;
        }

        console.log('STEAM CALLBACK: Valid OpenID callback detected');
        console.log('STEAM CALLBACK: claimed_id:', queryParams.get('openid.claimed_id'));
        console.log('STEAM CALLBACK: Processing Steam callback...');
        
        // Process the callback
        await processSteamCallback(queryParams);
        
        console.log('=== STEAM CALLBACK: Success! Completing... ===');
        
        // Redirect to home page on success
        onComplete();
      } catch (err) {
        console.error('=== STEAM CALLBACK: ERROR ===', err);
        let errorMessage = 'Authentication failed';
        
        if (err instanceof Error) {
          errorMessage = err.message;
          // Include status code if available
          if ((err as any).status) {
            errorMessage += ` (Status: ${(err as any).status})`;
          }
          // Include details if available
          if ((err as any).details) {
            console.error('Error details:', (err as any).details);
            // Try to extract message from details
            if ((err as any).details.message) {
              errorMessage = (err as any).details.message;
            } else if ((err as any).details.error) {
              errorMessage = (err as any).details.error;
            }
          }
        }
        
        console.error('Final error message:', errorMessage);
        setError(errorMessage);
        
        // Redirect to home after showing error
        setTimeout(onComplete, 5000); // Give more time to read error
      }
    };

    handleCallback();
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-500 mb-4 text-xl">{error}</div>
            <p className="text-gray-400">Redirecting...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-[#FF6A00] mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Completing Steam authentication...</p>
          </>
        )}
      </div>
    </div>
  );
}
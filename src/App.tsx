import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { LearnMorePage } from './components/LearnMorePage';
import { MarketplaceFeed } from './components/MarketplaceFeed';
import { UserDashboard } from './components/UserDashboard';
import SteamCallback from './components/SteamCallback';
import { Toaster } from 'sonner@2.0.3';
import { 
  initiatesteamLogin, 
  getCurrentUser, 
  logout,
  getCachedUser,
  type SteamUser 
} from './utils/steamAuth';

// Load image testing utilities in development
if (typeof window !== 'undefined') {
  import('./utils/testImageLoading').catch(() => {
    // Silently fail if module doesn't load
  });
}

export type Page = 'landing' | 'learn-more' | 'marketplace' | 'dashboard' | 'steam-callback';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [steamUser, setSteamUser] = useState<SteamUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const handleUserUpdate = (updatedUser: SteamUser) => {
    setSteamUser(updatedUser);
  };

  // Check for Steam callback on mount
  useEffect(() => {
    const path = window.location.pathname;
    const search = window.location.search;
    
    console.log('Current path:', path);
    console.log('Current search:', search);
    
    // Check if this is a Steam callback
    if (search.includes('openid.claimed_id')) {
      console.log('Detected Steam callback');
      setCurrentPage('steam-callback');
      setIsCheckingAuth(false);
      return;
    }

    if (path === '/steam-callback') {
      console.log('On steam-callback path');
      setCurrentPage('steam-callback');
      setIsCheckingAuth(false);
      return;
    }

    // Check for existing session
    checkAuth();
  }, []);

  const checkAuth = async () => {
    console.log('App: checkAuth starting...');
    // Try cached user first
    const cached = getCachedUser();
    if (cached) {
      console.log('App: Found cached user:', cached.personaName);
      setSteamUser(cached);
    } else {
      console.log('App: No cached user found');
    }

    // Verify with server
    const user = await getCurrentUser();
    console.log('App: getCurrentUser returned:', user ? user.personaName : 'null');
    setSteamUser(user);
    setIsCheckingAuth(false);
    
    // If user is logged in, redirect to marketplace
    if (user && currentPage === 'landing') {
      console.log('App: User logged in, redirecting to marketplace');
      setCurrentPage('marketplace');
    }
  };

  const handleSignIn = async () => {
    try {
      await initiatesteamLogin();
      // User will be redirected to Steam, then back to /steam-callback
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Failed to initiate Steam login. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await logout();
    setSteamUser(null);
    setCurrentPage('landing');
  };

  const handleSteamCallbackComplete = () => {
    // After Steam callback completes, refresh auth and go to marketplace
    checkAuth();
    setCurrentPage('marketplace');
    // Update URL
    window.history.pushState({}, '', '/');
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-[#FF6A00]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Toaster 
        position="top-right" 
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: '#1B2838',
            border: '1px solid #FF6A00',
            color: '#fff',
          },
        }}
      />
      
      {currentPage === 'steam-callback' && (
        <SteamCallback onComplete={handleSteamCallbackComplete} />
      )}
      
      {currentPage === 'landing' && (
        <LandingPage onSignIn={handleSignIn} onNavigate={setCurrentPage} />
      )}
      
      {currentPage === 'learn-more' && (
        <LearnMorePage onNavigate={setCurrentPage} onSignIn={handleSignIn} />
      )}
      
      {currentPage === 'marketplace' && (
        <MarketplaceFeed
          isAuthenticated={!!steamUser}
          steamUser={steamUser}
          onNavigate={setCurrentPage}
          onSignOut={handleSignOut}
          onSignIn={handleSignIn}
        />
      )}
      
      {currentPage === 'dashboard' && (
        <UserDashboard
          steamUser={steamUser}
          onNavigate={setCurrentPage}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
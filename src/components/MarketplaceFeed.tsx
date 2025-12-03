import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, User, LogOut, LayoutDashboard, Loader2, Settings, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { OfferCard } from './OfferCard';
import { CreateOfferModal } from './CreateOfferModal';
import { OfferDetailView } from './OfferDetailView';
import { TradeUrlModal } from './TradeUrlModal';
import type { Page } from '../App';
import type { TradeOffer } from './types';
import { getAllOffers } from '../utils/offerApi';
import type { SteamUser } from '../utils/steamAuth';
import { subscribeToOffers } from '../utils/realtimeSubscription';
import { subscribeToOffersPolling } from '../utils/pollingSubscription';
import { toast } from 'sonner@2.0.3';

interface MarketplaceFeedProps {
  isAuthenticated: boolean;
  steamUser: SteamUser | null;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  onSignIn: () => void;
}

type SortOrder = 'newest' | 'oldest';

export function MarketplaceFeed({ isAuthenticated, steamUser, onNavigate, onSignOut, onSignIn }: MarketplaceFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTradeUrlModal, setShowTradeUrlModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<TradeOffer | null>(null);
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localSteamUser, setLocalSteamUser] = useState(steamUser);

  // Update local state when steamUser changes
  useEffect(() => {
    setLocalSteamUser(steamUser);
  }, [steamUser]);

  // Check if user needs to set trade URL
  const needsTradeUrl = isAuthenticated && (!localSteamUser?.tradeUrl || localSteamUser.tradeUrl === null);

  const handleTradeUrlUpdate = (tradeUrl: string) => {
    if (localSteamUser) {
      const updatedUser = { ...localSteamUser, tradeUrl };
      setLocalSteamUser(updatedUser);
    }
  };

  const handleTradeUrlSet = () => {
    // After trade URL is set, open create offer modal
    setShowTradeUrlModal(false);
    setShowCreateModal(true);
  };

  // Debug auth state
  console.log('MarketplaceFeed: isAuthenticated:', isAuthenticated);
  console.log('MarketplaceFeed: steamUser:', steamUser ? steamUser.personaName : 'null');

  // Fetch offers on mount
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const fetchedOffers = await getAllOffers();
        setOffers(fetchedOffers);
      } catch (error) {
        console.error('Failed to fetch offers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffers();
  }, []);

  const handleCreateOffer = async (newOffer: TradeOffer) => {
    // Add the new offer immediately for instant feedback
    setOffers((prevOffers) => [newOffer, ...prevOffers]);
    setShowCreateModal(false);
    
    // Show success toast
    toast.success('Offer created successfully!');
  };

  const handleCreateOfferClick = () => {
    // Check if user has set their trade URL
    if (needsTradeUrl) {
      setShowTradeUrlModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  // Subscribe to real-time offers (DISABLED - using polling instead)
  // useEffect(() => {
  //   const unsubscribe = subscribeToOffers((newOffer) => {
  //     setOffers((prevOffers) => [newOffer, ...prevOffers]);
  //     toast.success('New offer added!');
  //   });

  //   return () => unsubscribe();
  // }, []);

  // Subscribe to offers polling (optimized: only poll when tab is visible)
  useEffect(() => {
    // Don't poll if tab is hidden (saves REST requests)
    if (document.hidden) {
      console.log('⏸️ Tab hidden, skipping polling setup');
      return;
    }
    
    // Use 30-second interval (reduced from 3s to prevent REST request spam)
    const unsubscribe = subscribeToOffersPolling((newOffer) => {
      setOffers((prevOffers) => {
        // Check if offer already exists (prevent duplicates)
        if (prevOffers.some(o => o.id === newOffer.id)) {
          console.log('⏭️ Skipping duplicate offer:', newOffer.id);
          return prevOffers;
        }
        
        // Add new offer
        toast.success('New offer added!');
        return [newOffer, ...prevOffers];
      });
    }, 30000); // 30 seconds instead of default 3 seconds

    // Stop polling when tab becomes hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('⏸️ Tab hidden, stopping polling');
        unsubscribe();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Filter and sort offers
  const filteredAndSortedOffers = React.useMemo(() => {
    let filtered = [...offers];

    // Filter by search query (complete word matching)
    if (searchQuery.trim()) {
      const queryWords = searchQuery.trim().toLowerCase().split(/\s+/);
      
      filtered = filtered.filter(offer => {
        // Check both offering and seeking items
        const allItemNames = [
          ...offer.offering.map(item => item.name.toLowerCase()),
          ...offer.seeking.map(item => item.name.toLowerCase())
        ].join(' ');

        // Check if any query word matches a complete word in item names
        return queryWords.some(queryWord => {
          // Create word boundary regex for complete word matching
          const wordRegex = new RegExp(`\\b${queryWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return wordRegex.test(allItemNames);
        });
      });

      // When filtering, prioritize most recent offers
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Apply sorting
    if (sortOrder === 'newest') {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortOrder === 'oldest') {
      filtered.sort((a, b) => a.timestamp - b.timestamp);
    }

    return filtered;
  }, [offers, searchQuery, sortOrder]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-deep)] via-[var(--bg-base)] to-[var(--bg-deep)]">
      {/* Header */}
      <header className="border-b border-[var(--bg-elevated)] bg-[var(--bg-base)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl">
              <span className="text-gradient-orange">CS TRADING</span> HUB
            </h2>
            
            <div className="flex items-center gap-4">
              {isAuthenticated && (
                <>
                  <Button
                    onClick={() => onNavigate('dashboard')}
                    variant="outline"
                    className="border-[var(--electric-blue)] text-[var(--electric-blue)] hover:bg-[var(--electric-blue)] hover:text-[var(--bg-deep)]"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                  
                  <Button
                    onClick={handleCreateOfferClick}
                    className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white glow-orange"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Offer
                  </Button>
                  
                  <Button
                    onClick={() => setShowTradeUrlModal(true)}
                    variant="ghost"
                    size="sm"
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    title="Set Trade URL"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-3 border-l border-[var(--bg-elevated)] pl-4">
                    <div className="flex items-center gap-2">
                      {steamUser?.avatarUrl && (
                        <img src={steamUser.avatarUrl} alt={steamUser.personaName} className="w-8 h-8 rounded-full" />
                      )}
                      <span className="text-[var(--text-secondary)]">{steamUser?.personaName || 'Player'}</span>
                    </div>
                    <Button
                      onClick={onSignOut}
                      variant="ghost"
                      size="sm"
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
              
              {!isAuthenticated && (
                <Button
                  onClick={onSignIn}
                  className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white glow-orange"
                >
                  <img src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png" alt="Sign in through Steam" className="h-6" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="border-b border-[var(--bg-elevated)] bg-[var(--bg-base)]/60 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
              <Input
                type="text"
                placeholder="Search by item name (e.g., AK-47, Knife, Case Hardened)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[var(--bg-elevated)] border-[var(--bg-overlay)] text-[var(--text-primary)] focus:border-[var(--electric-blue)]"
              />
            </div>
            
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--text-secondary)] whitespace-nowrap">Sort:</label>
              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="appearance-none bg-[var(--bg-elevated)] border border-[var(--bg-overlay)] rounded-lg px-4 py-2 pr-8 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--electric-blue)] cursor-pointer hover:border-[var(--bg-overlay)] transition-colors"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
              </div>
            </div>
          </div>
          
          {/* Search Results Count */}
          {searchQuery.trim() && (
            <div className="mt-3 text-sm text-[var(--text-secondary)]">
              Found {filteredAndSortedOffers.length} {filteredAndSortedOffers.length === 1 ? 'offer' : 'offers'} matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Marketplace Feed */}
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl text-[var(--text-secondary)]">
            {searchQuery.trim() ? 'Search Results' : 'Recent Offers'}{' '}
            <span className="text-[var(--cs-orange)] mono">
              {filteredAndSortedOffers.length}
            </span>
          </h3>
          {!searchQuery.trim() && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              {sortOrder === 'newest' ? (
                <>
                  <ArrowDown className="w-4 h-4" />
                  <span>Newest First</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-4 h-4" />
                  <span>Oldest First</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="text-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-[var(--text-tertiary)]" />
              <p className="text-2xl text-[var(--text-tertiary)] mt-4">Loading offers...</p>
            </div>
          ) : filteredAndSortedOffers.length > 0 ? (
            filteredAndSortedOffers.map((offer, index) => (
              <div
                key={offer.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <OfferCard offer={offer} onViewDetails={setSelectedOffer} isAuthenticated={isAuthenticated} />
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              {searchQuery.trim() ? (
                <>
                  <p className="text-2xl text-[var(--text-tertiary)] mb-4">No offers found</p>
                  <p className="text-[var(--text-secondary)] mb-4">
                    No offers match "{searchQuery}"
                  </p>
                  <Button
                    onClick={() => setSearchQuery('')}
                    variant="outline"
                    className="border-[var(--electric-blue)] text-[var(--electric-blue)] hover:bg-[var(--electric-blue)] hover:text-white"
                  >
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-2xl text-[var(--text-tertiary)] mb-4">No offers yet</p>
                  <p className="text-[var(--text-secondary)]">Be the first to create a trade offer!</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Offer Modal */}
      {showCreateModal && (
        <CreateOfferModal
          onClose={() => setShowCreateModal(false)}
          onCreateOffer={handleCreateOffer}
        />
      )}

      {/* Offer Detail View */}
      {selectedOffer && (
        <OfferDetailView
          offer={selectedOffer}
          onClose={() => setSelectedOffer(null)}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* Trade URL Modal */}
      {showTradeUrlModal && (
        <TradeUrlModal
          onClose={() => setShowTradeUrlModal(false)}
          currentTradeUrl={localSteamUser?.tradeUrl}
          onUpdate={handleTradeUrlUpdate}
          requiredForOffer={needsTradeUrl}
          onSet={handleTradeUrlSet}
        />
      )}
    </div>
  );
}
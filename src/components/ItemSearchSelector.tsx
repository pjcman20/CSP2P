import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Database } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import type { TradeItem, ItemRarity } from './types';
import { searchSkins, getPopularSearchTerms } from '../utils/csgoApi';

const RARITY_COLORS: Record<ItemRarity, string> = {
  consumer: 'var(--rarity-consumer)',
  industrial: 'var(--rarity-industrial)',
  milspec: 'var(--rarity-milspec)',
  restricted: 'var(--rarity-restricted)',
  classified: 'var(--rarity-classified)',
  covert: 'var(--rarity-covert)',
  gold: 'var(--rarity-gold)'
};

interface ItemSearchSelectorProps {
  onSelectItem: (item: TradeItem) => void;
  placeholder?: string;
}

export function ItemSearchSelector({ onSelectItem, placeholder = "Search for CS2 items..." }: ItemSearchSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TradeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setShowResults(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchSkins(searchQuery);
        // Limit to 50 results for UI performance
        setSearchResults(results.slice(0, 50));
        setShowResults(true);
        setIsLoading(false);
        
        if (results.length === 0) {
          setError('No items found. Try a different search term.');
        }
      } catch (err) {
        console.error('Search error:', err);
        setIsLoading(false);
        setSearchResults([]);
        setError('Error loading items. Please try again.');
      }
    }, 600); // 600ms debounce

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectItem = (item: TradeItem) => {
    onSelectItem(item);
    setSearchQuery('');
    setShowResults(false);
    setSearchResults([]);
    setError(null);
  };

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
    setShowResults(true);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim() !== '') {
              setShowResults(true);
            }
          }}
          className="pl-10 pr-10 bg-[var(--bg-elevated)] border-[var(--bg-overlay)] text-[var(--text-primary)]"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--cs-orange)] animate-spin" />
        )}
        {searchQuery && !isLoading && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
              setShowResults(false);
              setError(null);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-lg shadow-2xl max-h-96 overflow-y-auto">
          {error && (
            <div className="p-6 text-center">
              <p className="text-[var(--text-secondary)] text-sm">{error}</p>
            </div>
          )}

          {!error && searchResults.length === 0 && !isLoading && (
            <div className="p-8 text-center text-[var(--text-tertiary)]">
              <p>Start typing to search for items</p>
              <p className="text-sm mt-2">Try "AK-47", "AWP", or "Knife"</p>
            </div>
          )}

          {searchResults.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectItem(item)}
              className="w-full p-3 flex items-center gap-3 hover:bg-[var(--bg-elevated)] transition-colors border-b border-[var(--bg-elevated)]/50 last:border-b-0"
            >
              {/* Item Image */}
              <div
                className="w-16 h-16 bg-[var(--bg-elevated)] rounded border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: item.rarity ? RARITY_COLORS[item.rarity] : 'var(--bg-overlay)' }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-contain p-1"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-8 h-8 bg-[var(--bg-overlay)] rounded"></div>
                )}
              </div>

              {/* Item Info */}
              <div className="flex-1 text-left">
                <p className="text-sm text-[var(--text-primary)] mb-1">{item.name}</p>
                <div className="flex items-center gap-2">
                  {item.wear && (
                    <span className="text-xs text-[var(--text-tertiary)]">{item.wear}</span>
                  )}
                  {item.rarity && (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${RARITY_COLORS[item.rarity]}20`,
                        color: RARITY_COLORS[item.rarity]
                      }}
                    >
                      {item.rarity}
                    </span>
                  )}
                </div>
              </div>

              {/* Add Icon */}
              <div className="text-[var(--cs-orange)]">
                <Plus className="w-5 h-5" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Quick Category Filters */}
      {searchQuery.trim() === '' && !showResults && (
        <div className="mt-3">
          <p className="text-xs text-[var(--text-tertiary)] mb-2">Quick search:</p>
          <div className="flex flex-wrap gap-2">
            {getPopularSearchTerms().map(({ label, query }) => (
              <Button
                key={query}
                onClick={() => handleQuickSearch(query)}
                variant="outline"
                size="sm"
                className="border-[var(--bg-overlay)] text-[var(--text-secondary)] hover:border-[var(--cs-orange)] hover:text-[var(--cs-orange)]"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
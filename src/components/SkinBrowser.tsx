import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, Grid, List, X, Package } from 'lucide-react';
import type { TradeItem } from './types';
import { searchSkins } from '../utils/cs2SkinApi';
import { Input } from './ui/input';

interface SkinBrowserProps {
  onSelectSkin: (skin: TradeItem) => void;
  selectedSkins?: TradeItem[];
  filterByCategory?: 'knife' | 'rifle' | 'pistol' | 'smg' | 'heavy' | 'gloves';
  maxResults?: number;
}

const RARITY_COLORS: Record<string, string> = {
  consumer: '#b0c3d9',
  industrial: '#5e98d9',
  milspec: '#4b69ff',
  restricted: '#8847ff',
  classified: '#d32ce6',
  covert: '#eb4b4b',
  gold: '#ffd700',
  ancient: '#ffd700',
  legendary: '#eb4b4b',
  mythical: '#d32ce6',
  rare: '#8847ff',
  uncommon: '#5e98d9',
  common: '#b0c3d9',
};

export function SkinBrowser({ 
  onSelectSkin, 
  selectedSkins = [], 
  filterByCategory,
  maxResults = 10000 // Effectively unlimited - will load all available skins
}: SkinBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [skins, setSkins] = useState<TradeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if skin is already selected
  const isSkinSelected = useCallback((skin: TradeItem) => {
    return selectedSkins.some(s => s.id === skin.id || s.name === skin.name);
  }, [selectedSkins]);

  // Load skins based on search query
  useEffect(() => {
    const loadSkins = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let results: TradeItem[] = [];

        if (searchQuery.trim()) {
          // Search mode - search for the query
          results = await searchSkins(searchQuery.trim(), maxResults);
        } else {
          // No search query - load ALL CS2 items by searching for common terms
          // Use broad search terms to get maximum coverage
          const broadTerms = [
            'CS', 'Counter-Strike', 'weapon', 'skin', 'knife', 'rifle', 'pistol',
            'AK', 'AWP', 'M4', 'Glock', 'USP', 'Desert', 'glove'
          ];
          
          const allResults: TradeItem[] = [];
          const seenNames = new Set<string>();
          
          // Load from multiple broad search terms to get comprehensive coverage
          for (const term of broadTerms) {
            try {
              const termResults = await searchSkins(term, Math.ceil(maxResults / broadTerms.length));
              
              // Add unique items only
              for (const item of termResults) {
                if (!seenNames.has(item.name)) {
                  seenNames.add(item.name);
                  allResults.push(item);
                }
              }
              
              // Small delay between searches to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err) {
              console.warn(`Failed to load skins for term "${term}":`, err);
              // Continue with other terms
            }
          }
          
          results = allResults.slice(0, maxResults);
        }

        setSkins(results);
      } catch (err) {
        console.error('Error loading skins:', err);
        setError('Failed to load skins. Please try again.');
        setSkins([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadSkins();
    }, searchQuery.trim() ? 500 : 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, maxResults]);


  const handleSelectSkin = (skin: TradeItem) => {
    if (!isSkinSelected(skin)) {
      onSelectSkin(skin);
    }
  };

  const getRarityColor = (rarity?: string): string => {
    if (!rarity) return RARITY_COLORS.common;
    return RARITY_COLORS[rarity.toLowerCase()] || RARITY_COLORS.common;
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for any CS2 skin... (e.g., AK-47, AWP, Karambit, M4A4, Desert Eagle)"
          className="w-full pl-12 pr-10 bg-[var(--bg-deep)] border-[var(--bg-overlay)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--electric-blue)] focus:ring-2 focus:ring-[var(--electric-blue)]/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setViewMode('grid')}
          className={`p-2 rounded-lg transition-all ${
            viewMode === 'grid'
              ? 'bg-[var(--electric-blue)]/20 text-[var(--electric-blue)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-2 rounded-lg transition-all ${
            viewMode === 'list'
              ? 'bg-[var(--electric-blue)]/20 text-[var(--electric-blue)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[var(--electric-blue)] animate-spin" />
          <span className="ml-3 text-[var(--text-secondary)]">Loading skins...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4 text-center">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && !error && skins.length > 0 && (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[800px] overflow-y-auto'
          : 'space-y-2 max-h-[800px] overflow-y-auto'
        }>
          {skins.map((skin) => {
            const isSelected = isSkinSelected(skin);
            const rarityColor = getRarityColor(skin.rarity);

            return viewMode === 'grid' ? (
              <button
                key={skin.id}
                onClick={() => handleSelectSkin(skin)}
                disabled={isSelected}
                className={`group relative bg-[var(--bg-elevated)] border-2 rounded-lg p-3 transition-all duration-300 ${
                  isSelected
                    ? 'border-[var(--cs-orange)] opacity-60 cursor-not-allowed'
                    : 'border-[var(--bg-overlay)] hover:border-[var(--electric-blue)] hover:shadow-lg hover:shadow-[var(--electric-blue)]/20 hover:scale-105'
                }`}
              >
                {/* Rarity Border */}
                <div
                  className="absolute inset-0 rounded-lg opacity-20"
                  style={{ borderColor: rarityColor }}
                />
                
                {/* Image */}
                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-[var(--bg-deep)] mb-2 border border-[var(--bg-overlay)]">
                  {skin.image && !failedImages.has(skin.image) ? (
                    <>
                      {!loadedImages.has(skin.image) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-deep)] animate-pulse">
                          <Package className="w-6 h-6 text-[var(--text-tertiary)] opacity-50" />
                        </div>
                      )}
                      <img
                        src={skin.image}
                        alt={skin.name}
                        className={`w-full h-full object-contain p-2 transition-opacity duration-300 ${
                          loadedImages.has(skin.image) ? 'opacity-100' : 'opacity-0'
                        }`}
                        loading="lazy"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer-when-downgrade"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          setFailedImages(prev => new Set(prev).add(skin.image!));
                          target.style.display = 'none';
                        }}
                        onLoad={() => {
                          setLoadedImages(prev => new Set(prev).add(skin.image!));
                        }}
                      />
                      {failedImages.has(skin.image) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <p className="text-xs text-[var(--text-primary)] text-center line-clamp-2 mb-1">
                  {skin.name}
                </p>

                {/* Rarity Badge */}
                {skin.rarity && (
                  <div
                    className="text-xs px-2 py-0.5 rounded-full text-center font-medium"
                    style={{
                      backgroundColor: `${rarityColor}20`,
                      color: rarityColor
                    }}
                  >
                    {skin.rarity}
                  </div>
                )}

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--cs-orange)] rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}

                {/* Hover Add Icon */}
                {!isSelected && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-6 h-6 bg-[var(--electric-blue)] rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  </div>
                )}
              </button>
            ) : (
              <button
                key={skin.id}
                onClick={() => handleSelectSkin(skin)}
                disabled={isSelected}
                className={`w-full bg-[var(--bg-elevated)] border-2 rounded-lg p-3 flex items-center gap-3 transition-all duration-300 ${
                  isSelected
                    ? 'border-[var(--cs-orange)] opacity-60 cursor-not-allowed'
                    : 'border-[var(--bg-overlay)] hover:border-[var(--electric-blue)]'
                }`}
              >
                {/* Image */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[var(--bg-deep)] border border-[var(--bg-overlay)] flex-shrink-0">
                  {skin.image && !failedImages.has(skin.image) ? (
                    <>
                      {!loadedImages.has(skin.image) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-deep)] animate-pulse">
                          <Package className="w-4 h-4 text-[var(--text-tertiary)] opacity-50" />
                        </div>
                      )}
                      <img
                        src={skin.image}
                        alt={skin.name}
                        className={`w-full h-full object-contain p-2 transition-opacity duration-300 ${
                          loadedImages.has(skin.image) ? 'opacity-100' : 'opacity-0'
                        }`}
                        loading="lazy"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer-when-downgrade"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          setFailedImages(prev => new Set(prev).add(skin.image!));
                          target.style.display = 'none';
                        }}
                        onLoad={() => {
                          setLoadedImages(prev => new Set(prev).add(skin.image!));
                        }}
                      />
                      {failedImages.has(skin.image) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Package className="w-6 h-6 text-[var(--text-tertiary)]" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-[var(--text-tertiary)]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    {skin.name}
                  </p>
                  {skin.rarity && (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${rarityColor}20`,
                          color: rarityColor
                        }}
                      >
                        {skin.rarity}
                      </span>
                      {skin.weapon && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {skin.weapon}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Add Icon */}
                {!isSelected && (
                  <div className="text-[var(--electric-blue)]">
                    <div className="w-6 h-6 rounded-full border-2 border-[var(--electric-blue)] flex items-center justify-center">
                      <div className="w-2 h-2 bg-[var(--electric-blue)] rounded-full" />
                    </div>
                  </div>
                )}
                {isSelected && (
                  <div className="text-[var(--cs-orange)]">
                    <div className="w-6 h-6 rounded-full bg-[var(--cs-orange)] flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && skins.length === 0 && (
        <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border border-dashed border-[var(--bg-overlay)] rounded-xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--bg-deep)] mb-4">
            <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-1">
            {searchQuery ? 'No skins found' : 'No skins available'}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {searchQuery ? 'Try a different search term' : 'Select a category or search for skins'}
          </p>
        </div>
      )}

      {/* Results Count */}
      {!isLoading && !error && skins.length > 0 && (
        <div className="text-center">
          <p className="text-xs text-[var(--text-tertiary)]">
            Showing {skins.length} {skins.length === 1 ? 'skin' : 'skins'}
          </p>
        </div>
      )}
    </div>
  );
}


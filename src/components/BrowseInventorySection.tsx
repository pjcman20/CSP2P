import { useState, useEffect } from 'react';
import { SlidersHorizontal, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getPopularItems } from '../utils/csgoApi';
import type { TradeItem, ItemRarity } from './types';

const RARITY_COLORS: Record<ItemRarity, string> = {
  consumer: 'var(--rarity-consumer)',
  industrial: 'var(--rarity-industrial)',
  milspec: 'var(--rarity-milspec)',
  restricted: 'var(--rarity-restricted)',
  classified: 'var(--rarity-classified)',
  covert: 'var(--rarity-covert)',
  gold: 'var(--rarity-gold)'
};

interface BrowseInventorySectionProps {
  items?: TradeItem[];
  selectedItems: TradeItem[];
  onToggleItem: (item: TradeItem) => void;
}

export function BrowseInventorySection({ selectedItems, onToggleItem }: BrowseInventorySectionProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [allItems, setAllItems] = useState<TradeItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<TradeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter states
  const [priceRange, setPriceRange] = useState<[number]>([5000]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [selectedWear, setSelectedWear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('popular');

  // Load popular items on mount
  useEffect(() => {
    loadPopularItems();
  }, []);

  // Apply filters whenever filter state changes
  useEffect(() => {
    applyFilters();
  }, [priceRange, selectedCategory, selectedRarity, selectedWear, sortBy, allItems]);

  const loadPopularItems = async () => {
    setIsLoading(true);
    try {
      // Load from CSGO-API community database - gets 500+ popular items
      const items = await getPopularItems();
      
      setAllItems(items);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading items:', error);
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allItems];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Filter by rarity
    if (selectedRarity !== 'all') {
      filtered = filtered.filter(item => item.rarity === selectedRarity);
    }

    // Filter by wear
    if (selectedWear !== 'all') {
      filtered = filtered.filter(item => item.wear === selectedWear);
    }

    // Filter by price range
    if (priceRange[0] < 5000) {
      filtered = filtered.filter(item => {
        if (!item.price) return true; // Keep items without price data
        return item.price <= priceRange[0];
      });
    }

    // Apply sorting
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceA - priceB;
        });
        break;
      case 'price-high':
        filtered.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceB - priceA;
        });
        break;
      case 'name-asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'rarity':
        const rarityOrder: Record<ItemRarity, number> = {
          consumer: 1,
          industrial: 2,
          milspec: 3,
          restricted: 4,
          classified: 5,
          covert: 6,
          gold: 7
        };
        filtered.sort((a, b) => {
          const rarityA = a.rarity ? rarityOrder[a.rarity] : 0;
          const rarityB = b.rarity ? rarityOrder[b.rarity] : 0;
          return rarityB - rarityA;
        });
        break;
      default:
        // 'popular' - keep original order from Steam
        break;
    }

    setFilteredItems(filtered);
  };

  const resetFilters = () => {
    setPriceRange([5000]);
    setSelectedCategory('all');
    setSelectedRarity('all');
    setSelectedWear('all');
  };

  return (
    <div className="border-t border-[var(--bg-elevated)] pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <p className="text-sm text-[var(--text-tertiary)]">
            Browse all items ({filteredItems.length} available)
          </p>
          
          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px] bg-[var(--bg-elevated)] border-[var(--bg-overlay)]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="name-asc">Name: A to Z</SelectItem>
              <SelectItem value="name-desc">Name: Z to A</SelectItem>
              <SelectItem value="rarity">Highest Rarity</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => loadPopularItems()}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="border-[var(--bg-overlay)] text-[var(--text-secondary)]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className="border-[var(--bg-overlay)] text-[var(--text-secondary)]"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--bg-overlay)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-[var(--bg-base)] border-[var(--bg-overlay)]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="knife">Knives</SelectItem>
                  <SelectItem value="glove">Gloves</SelectItem>
                  <SelectItem value="rifle">Rifles</SelectItem>
                  <SelectItem value="pistol">Pistols</SelectItem>
                  <SelectItem value="smg">SMGs</SelectItem>
                  <SelectItem value="sniper">Snipers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rarity Filter */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-2 block">Rarity</label>
              <Select value={selectedRarity} onValueChange={setSelectedRarity}>
                <SelectTrigger className="bg-[var(--bg-base)] border-[var(--bg-overlay)]">
                  <SelectValue placeholder="All Rarities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  <SelectItem value="consumer">Consumer</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="milspec">Mil-Spec</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="classified">Classified</SelectItem>
                  <SelectItem value="covert">Covert</SelectItem>
                  <SelectItem value="gold">Gold/Contraband</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Wear Filter */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-2 block">Wear</label>
              <Select value={selectedWear} onValueChange={setSelectedWear}>
                <SelectTrigger className="bg-[var(--bg-base)] border-[var(--bg-overlay)]">
                  <SelectValue placeholder="All Wears" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wears</SelectItem>
                  <SelectItem value="Factory New">Factory New</SelectItem>
                  <SelectItem value="Minimal Wear">Minimal Wear</SelectItem>
                  <SelectItem value="Field-Tested">Field-Tested</SelectItem>
                  <SelectItem value="Well-Worn">Well-Worn</SelectItem>
                  <SelectItem value="Battle-Scarred">Battle-Scarred</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-2 block">
                Max Price: ${priceRange[0]}
              </label>
              <Slider
                value={priceRange}
                onValueChange={(value) => setPriceRange(value as [number])}
                min={0}
                max={5000}
                step={50}
                className="mt-2"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={resetFilters}
              variant="outline"
              size="sm"
              className="border-[var(--bg-overlay)] text-[var(--text-secondary)]"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      )}

      {/* Items Grid with Larger Scrolling Area */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[var(--cs-orange)] animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">Loading items...</p>
            </div>
          </div>
        )}

        <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredItems.length === 0 && !isLoading ? (
            <div className="py-12 text-center text-[var(--text-tertiary)]">
              <p>No items found with current filters</p>
              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="mt-4 border-[var(--cs-orange)] text-[var(--cs-orange)]"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredItems.map(item => (
                <BrowseItemCard
                  key={item.id}
                  item={item}
                  selected={!!selectedItems.find(i => i.id === item.id)}
                  onToggle={() => onToggleItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BrowseItemCard({ item, selected, onToggle }: { item: TradeItem; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative bg-[var(--bg-elevated)] rounded-lg p-3 border-2 transition-all hover:scale-105 ${
        selected
          ? 'border-[var(--cs-orange)] glow-orange'
          : 'border-transparent hover:border-[var(--bg-overlay)]'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--cs-orange)] rounded-full flex items-center justify-center z-10">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
      
      {/* Rarity border */}
      <div
        className="absolute inset-0 rounded-lg opacity-20"
        style={{
          background: item.rarity ? RARITY_COLORS[item.rarity] : 'transparent'
        }}
      />

      <div className="relative">
        <img 
          src={item.image} 
          alt={item.name} 
          className="w-full h-24 object-contain mb-2" 
          loading="lazy"
        />
        <p className="text-xs truncate text-[var(--text-primary)]">{item.name}</p>
        <div className="flex items-center justify-between mt-1">
          {item.wear ? (
            <p className="text-xs text-[var(--text-tertiary)]">{item.wear}</p>
          ) : (
            <span />
          )}
          {item.price && (
            <p className="text-xs text-[var(--electric-blue)]">${item.price.toFixed(2)}</p>
          )}
        </div>
        {item.rarity && (
          <div className="mt-1">
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${RARITY_COLORS[item.rarity]}30`,
                color: RARITY_COLORS[item.rarity]
              }}
            >
              {item.rarity}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
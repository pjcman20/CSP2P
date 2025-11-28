import { useState, useEffect } from 'react';
import { X, Search, Loader2, AlertCircle, Package, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { fetchInventory, type ParsedInventoryItem } from '../utils/steamInventoryFetcher';
import type { TradeItem } from './types';

interface InventorySelectorProps {
  onClose: () => void;
  onSelectItems: (items: TradeItem[]) => void;
  steamId: string;
  title: string;
}

export function InventorySelector({ onClose, onSelectItems, steamId, title }: InventorySelectorProps) {
  const [inventory, setInventory] = useState<ParsedInventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<ParsedInventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInventory();
  }, [steamId]);

  useEffect(() => {
    // Filter inventory based on search
    if (searchQuery.trim() === '') {
      setFilteredInventory(inventory);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = inventory.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.marketName.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      );
      setFilteredInventory(filtered);
    }
  }, [searchQuery, inventory]);

  const loadInventory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const items = await fetchInventory(steamId);
      setInventory(items);
      setFilteredInventory(items);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleConfirm = () => {
    const items: TradeItem[] = Array.from(selectedItems).map(itemId => {
      const item = inventory.find(i => i.id === itemId)!;
      return {
        name: item.marketName,
        image: item.iconUrl,
        rarity: item.rarity,
        wear: item.wear,
        statTrak: item.statTrak,
        type: item.type,
      };
    });
    
    onSelectItems(items);
    onClose();
  };

  const getRarityColor = (rarity: string) => {
    const rarityMap: Record<string, string> = {
      'Consumer Grade': '#B0C3D9',
      'Industrial Grade': '#5E98D9',
      'Mil-Spec Grade': '#4B69FF',
      'Restricted': '#8847FF',
      'Classified': '#D32CE6',
      'Covert': '#EB4B4B',
      'Contraband': '#E4AE39',
      'Extraordinary': '#FFD700',
    };
    return rarityMap[rarity] || '#B0C3D9';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-base)] rounded-lg border border-[var(--bg-elevated)] w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--bg-elevated)]">
          <div>
            <h3 className="text-2xl text-[var(--text-primary)]">{title}</h3>
            <p className="text-[var(--text-secondary)] mt-1">
              {selectedItems.size > 0 ? `${selectedItems.size} item(s) selected` : 'Select items from your inventory'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[var(--bg-elevated)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[var(--bg-elevated)] border-[var(--bg-overlay)]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-[var(--cs-orange)] mb-4" />
              <p className="text-[var(--text-secondary)]">Loading your CS2 inventory...</p>
              <p className="text-[var(--text-tertiary)] text-sm mt-2">This may take a few seconds</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-red-500 font-medium mb-2">Failed to Load Inventory</h4>
                    <p className="text-[var(--text-secondary)] text-sm">{error}</p>
                    <Button
                      onClick={loadInventory}
                      className="mt-4 bg-red-500 hover:bg-red-600 text-white"
                      size="sm"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && filteredInventory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Package className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
              <p className="text-[var(--text-secondary)]">
                {searchQuery ? 'No items match your search' : 'No tradable items in inventory'}
              </p>
            </div>
          )}

          {!isLoading && !error && filteredInventory.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredInventory.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const rarityColor = getRarityColor(item.rarity);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItemSelection(item.id)}
                    className={`
                      relative bg-[var(--bg-elevated)] rounded-lg p-3 transition-all
                      hover:bg-[var(--bg-overlay)] hover:scale-105
                      ${isSelected ? 'ring-2 ring-[var(--cs-orange)] bg-[var(--bg-overlay)]' : ''}
                    `}
                  >
                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-[var(--cs-orange)] rounded-full p-1">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {/* Item Image */}
                    <div className="aspect-square bg-gradient-to-br from-[var(--bg-base)] to-[var(--bg-elevated)] rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Item Name */}
                    <div className="text-left">
                      <p
                        className="text-sm truncate"
                        style={{ color: rarityColor }}
                        title={item.marketName}
                      >
                        {item.statTrak && <span className="text-[var(--cs-orange)]">ST™ </span>}
                        {item.souvenir && <span className="text-yellow-500">SV </span>}
                        {item.name}
                      </p>
                      {item.wear && (
                        <p className="text-xs text-[var(--text-tertiary)] truncate">
                          {item.wear}
                        </p>
                      )}
                    </div>

                    {/* Rarity Badge */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                      style={{ backgroundColor: rarityColor }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--bg-elevated)] flex items-center justify-between">
          <p className="text-[var(--text-tertiary)] text-sm">
            {filteredInventory.length} tradable items
          </p>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
              className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {selectedItems.size > 0 && `(${selectedItems.size})`} Items
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

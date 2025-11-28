import React, { useState } from 'react';
import { Plus, X, Search } from 'lucide-react';
import type { TradeItem } from './types';
import { CS2_ITEMS_DATABASE, ITEMS_BY_CATEGORY, searchCS2Items } from '../utils/cs2ItemDatabase';
import { CS2ItemImage } from './CS2ItemImage';
import { Package } from 'lucide-react';
import anyKnifeImg from 'figma:asset/03d9db583e449a92fde00c448df118b1af8d15e8.png';
import anyOffersImg from 'figma:asset/c7a308326a8c9c7e5c58132136efd031fa5d15a3.png';
import anyCasesImg from 'figma:asset/3e9bb08c27025418783d5bf1ca0e5e1be75f1a05.png';

interface ManualItemEntryProps {
  items: TradeItem[];
  onAddItem: (item: TradeItem) => void;
  onRemoveItem: (id: string) => void;
  label: string;
}

const SPECIAL_ITEMS = [
  { name: 'Any Knife', image: anyKnifeImg, rarity: 'ancient' },
  { name: 'Any Offers', image: anyOffersImg, rarity: 'legendary' },
  { name: 'Any Cases', image: anyCasesImg, rarity: 'mythical' }
] as const;

export function ManualItemEntry({ items, onAddItem, onRemoveItem, label }: ManualItemEntryProps) {
  const [customItemName, setCustomItemName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'knife' | 'rifle' | 'pistol' | 'smg' | 'heavy'>('all');

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;

    const newItem: TradeItem = {
      id: `custom_${Date.now()}`,
      name: customItemName.trim(),
      rarity: 'common',
    };

    onAddItem(newItem);
    setCustomItemName('');
  };

  const handleAddDatabaseItem = (dbItem: typeof CS2_ITEMS_DATABASE[0]) => {
    const newItem: TradeItem = {
      id: `db_${Date.now()}_${Math.random()}`,
      name: dbItem.name,
      image: dbItem.icon,
      rarity: dbItem.rarity as any,
    };

    onAddItem(newItem);
  };

  const handleAddSpecialItem = (specialItem: typeof SPECIAL_ITEMS[number]) => {
    const newItem: TradeItem = {
      id: `special_${Date.now()}_${Math.random()}`,
      name: specialItem.name,
      image: specialItem.image,
      rarity: specialItem.rarity as any,
    };

    onAddItem(newItem);
  };

  // Filter items based on search and category
  const filteredItems = React.useMemo(() => {
    let items = selectedCategory === 'all' 
      ? CS2_ITEMS_DATABASE 
      : ITEMS_BY_CATEGORY[selectedCategory];

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(lowerQuery) ||
        item.weapon?.toLowerCase().includes(lowerQuery)
      );
    }

    return items.slice(0, 100); // Limit to 100 for performance
  }, [searchQuery, selectedCategory]);

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: 'text-gray-400',
      uncommon: 'text-green-400',
      rare: 'text-blue-400',
      mythical: 'text-purple-400',
      legendary: 'text-pink-400',
      ancient: 'text-red-400',
    };
    return colors[rarity] || 'text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Current Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-400">{label}</label>
          <span className="text-xs text-gray-500">{items.length} items</span>
        </div>
        
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-3 flex items-center gap-3 group hover:border-gray-700 transition-colors"
              >
                {item.image ? (
                  <div className="w-12 h-12 rounded overflow-hidden bg-[#0a0e1a] flex items-center justify-center">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to package icon if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="w-full h-full items-center justify-center" style={{ display: 'none' }}>
                      <Package className="w-6 h-6 text-gray-600" />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-[#1a1f2e] border border-gray-700 rounded flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  {item.rarity && (
                    <p className={`text-xs ${getRarityColor(item.rarity)}`}>
                      {item.rarity}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1a1f2e] border border-dashed border-gray-700 rounded-lg p-6 text-center mb-4">
            <p className="text-sm text-gray-400">No items added yet</p>
            <p className="text-xs text-gray-500 mt-1">Add items from popular items below or enter custom names</p>
          </div>
        )}
      </div>

      {/* Special Items - Any Knife, Any Offers, Any Cases */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Quick Add Placeholders</label>
        <div className="grid grid-cols-3 gap-2">
          {SPECIAL_ITEMS.map((specialItem) => (
            <button
              key={specialItem.name}
              onClick={() => handleAddSpecialItem(specialItem)}
              className="bg-[#1a1f2e] border-2 border-[#FF6A00] rounded-lg p-3 flex flex-col items-center gap-2 hover:bg-[#1e2433] hover:border-[#ff8534] transition-all group"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#0a0e1a] flex items-center justify-center">
                <img
                  src={specialItem.image}
                  alt={specialItem.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-white font-medium">{specialItem.name}</p>
                <p className={`text-xs ${getRarityColor(specialItem.rarity)}`}>
                  {specialItem.rarity}
                </p>
              </div>
              <Plus className="w-4 h-4 text-[#FF6A00] group-hover:text-[#ff8534]" />
            </button>
          ))}
        </div>
      </div>

      {/* Custom Item Entry */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Add Custom Item</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customItemName}
            onChange={(e) => setCustomItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
            placeholder="e.g., AK-47 | Case Hardened"
            className="flex-1 bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6A00]"
          />
          <button
            onClick={handleAddCustomItem}
            disabled={!customItemName.trim()}
            className="bg-[#FF6A00] hover:bg-[#ff8534] disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Popular Items */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">
          Browse CS2 Items ({CS2_ITEMS_DATABASE.length} total)
        </label>
        
        {/* Category Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {(['all', 'knife', 'rifle', 'pistol', 'smg', 'heavy'] as const).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-[#FF6A00] text-white'
                  : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#1e2433] hover:text-gray-300'
              }`}
            >
              {category === 'all' ? '🔥 All' : 
               category === 'knife' ? '🔪 Knives' :
               category === 'rifle' ? '🎯 Rifles' :
               category === 'pistol' ? '🔫 Pistols' :
               category === 'smg' ? '💨 SMGs' :
               '💥 Heavy'}
            </button>
          ))}
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items... (e.g., Doppler, Fade, AK-47)"
            className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6A00]"
          />
        </div>

        {/* Results count */}
        <p className="text-xs text-gray-500 mb-2">
          Showing {filteredItems.length} items
          {filteredItems.length >= 100 && ' (limited to 100 for performance)'}
        </p>

        {/* Items Grid */}
        <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">{filteredItems.map((item) => (
            <button
              key={`${item.name}_${item.weapon}`}
              onClick={() => handleAddDatabaseItem(item)}
              className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-3 flex items-center gap-3 hover:border-[#FF6A00] hover:bg-[#1e2433] transition-colors text-left"
            >
              <CS2ItemImage src={item.icon} alt={item.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.name}</p>
                <p className={`text-xs ${getRarityColor(item.rarity)}`}>
                  {item.rarity}
                </p>
              </div>
              <Plus className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
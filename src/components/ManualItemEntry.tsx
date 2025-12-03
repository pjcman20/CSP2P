import React, { useState } from 'react';
import { Plus, X, Shield, AlertCircle, Database } from 'lucide-react';
import type { TradeItem } from './types';
import { Package } from 'lucide-react';
import { SkinBrowser } from './SkinBrowser';
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

const WEAR_CONDITIONS = [
  { value: 'Factory New', label: 'Factory New', short: 'FN', color: 'from-emerald-500 to-green-400' },
  { value: 'Minimal Wear', label: 'Minimal Wear', short: 'MW', color: 'from-blue-500 to-cyan-400' },
  { value: 'Field-Tested', label: 'Field-Tested', short: 'FT', color: 'from-yellow-500 to-orange-400' },
  { value: 'Well-Worn', label: 'Well-Worn', short: 'WW', color: 'from-orange-500 to-red-400' },
  { value: 'Battle-Scarred', label: 'Battle-Scarred', short: 'BS', color: 'from-red-600 to-red-500' },
] as const;

export function ManualItemEntry({ items, onAddItem, onRemoveItem, label }: ManualItemEntryProps) {
  const [customItemName, setCustomItemName] = useState('');
  const [selectedWear, setSelectedWear] = useState<string>('');
  const [showSkinBrowser, setShowSkinBrowser] = useState(false);

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;

    const newItem: TradeItem = {
      id: `custom_${Date.now()}_${Math.random()}`,
      name: customItemName.trim(),
      wear: selectedWear || undefined,
      rarity: 'common',
    };

    onAddItem(newItem);
    setCustomItemName('');
    setSelectedWear('');
  };

  const handleSelectSkin = (skin: TradeItem) => {
    // Immediately add the skin - wear condition is optional
    const newItem: TradeItem = {
      ...skin,
      id: `skin_${Date.now()}_${Math.random()}`,
      // Keep wear from skin name if it exists, otherwise leave undefined
    };

    onAddItem(newItem);
    setShowSkinBrowser(false);
  };

  const handleAddSpecialItem = (specialItem: typeof SPECIAL_ITEMS[number]) => {
    const newItem: TradeItem = {
      id: `special_${Date.now()}_${Math.random()}`,
      name: specialItem.name,
      image: specialItem.image,
      rarity: specialItem.rarity as any,
      isPlaceholder: true,
      category: specialItem.name === 'Any Knife' ? 'knife' : 
                specialItem.name === 'Any Cases' ? 'cases' : 'offers',
    };

    onAddItem(newItem);
  };

  const getWearColor = (wear?: string) => {
    if (!wear) return 'border-gray-600';
    const wearData = WEAR_CONDITIONS.find(w => w.value === wear);
    return wearData ? `border-gradient-${wearData.short.toLowerCase()}` : 'border-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Current Items - Futuristic Card Design */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
          <span className="text-xs px-3 py-1 bg-[var(--bg-elevated)] rounded-full text-[var(--text-secondary)] border border-[var(--bg-overlay)]">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => {
              const wearData = item.wear ? WEAR_CONDITIONS.find(w => w.value === item.wear) : null;
              return (
                <div
                  key={item.id}
                  className="group relative bg-[var(--bg-elevated)] border border-[var(--bg-overlay)] rounded-lg p-3 flex items-center gap-3 hover:border-[var(--electric-blue)] transition-all duration-300"
                >
                  {item.image ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-deep)] border border-[var(--bg-overlay)] flex-shrink-0">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full items-center justify-center hidden">
                        <Package className="w-5 h-5 text-[var(--text-tertiary)]" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-[var(--bg-deep)] border border-[var(--bg-overlay)] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-[var(--text-tertiary)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {item.name}
                    </p>
                    {item.wear && wearData && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{wearData.short}</p>
                    )}
                    {item.isPlaceholder && (
                      <p className="text-xs text-[var(--electric-blue)] mt-0.5">Placeholder</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border border-dashed border-[var(--bg-overlay)] rounded-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--bg-deep)] mb-4">
              <Package className="w-8 h-8 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">No items added yet</p>
            <p className="text-xs text-[var(--text-tertiary)]">Add items using the form below</p>
          </div>
        )}
      </div>

      {/* Browse All Skins Section */}
      <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border border-[var(--bg-overlay)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--electric-blue)]" />
            <label className="text-sm font-medium text-[var(--text-primary)]">Browse All CS2 Skins</label>
          </div>
          <button
            onClick={() => setShowSkinBrowser(!showSkinBrowser)}
            className="text-xs px-3 py-1.5 bg-[var(--bg-deep)] border border-[var(--bg-overlay)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--electric-blue)] transition-all"
          >
            {showSkinBrowser ? 'Hide Browser' : 'Show Browser'}
          </button>
        </div>
        
        {showSkinBrowser && (
          <div className="mt-4">
            <SkinBrowser
              onSelectSkin={handleSelectSkin}
              selectedSkins={items}
              maxResults={100}
            />
          </div>
        )}
      </div>

      {/* Quick Add Placeholders - Compact Design */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[var(--electric-blue)]" />
          <label className="text-sm font-medium text-[var(--text-primary)]">Quick Add Placeholders</label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SPECIAL_ITEMS.map((specialItem) => (
            <button
              key={specialItem.name}
              onClick={() => handleAddSpecialItem(specialItem)}
              className="group relative bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border-2 border-[var(--cs-orange)]/30 rounded-lg p-3 flex flex-col items-center gap-2 hover:border-[var(--cs-orange)] hover:shadow-lg hover:shadow-[var(--cs-orange)]/20 transition-all duration-300"
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-deep)] border border-[var(--bg-overlay)]">
                <img
                  src={specialItem.image}
                  alt={specialItem.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-[var(--text-primary)]">{specialItem.name}</p>
              </div>
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-3 h-3 text-[var(--cs-orange)]" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Item Entry - Futuristic Form */}
      <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border border-[var(--bg-overlay)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-[var(--electric-blue)]" />
          <label className="text-sm font-medium text-[var(--text-primary)]">Add Custom Item</label>
        </div>
        
        <div className="space-y-4">
          {/* Item Name Input */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
              Item Name <span className="text-[var(--text-tertiary)]">(Required)</span>
            </label>
            <input
              type="text"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customItemName.trim()) {
                  handleAddCustomItem();
                }
              }}
              placeholder="e.g., AK-47 | Case Hardened"
              className="w-full bg-[var(--bg-deep)] border border-[var(--bg-overlay)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--electric-blue)] focus:ring-2 focus:ring-[var(--electric-blue)]/20 transition-all"
            />
          </div>

          {/* Wear Condition Selector - Optional */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
              Wear Condition <span className="text-[var(--text-tertiary)] font-normal">(Optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {WEAR_CONDITIONS.map((wear) => {
                const isSelected = selectedWear === wear.value;
                return (
                  <button
                    key={wear.value}
                    onClick={() => setSelectedWear(isSelected ? '' : wear.value)}
                    className={`relative group px-5 py-4 rounded-lg border-2 transition-all duration-300 flex items-center gap-2 min-h-[48px] ${
                      isSelected
                        ? 'border-transparent text-white shadow-lg scale-105'
                        : 'border-[var(--bg-overlay)] bg-[var(--bg-deep)] text-[var(--text-secondary)] hover:border-[var(--electric-blue)]/50 hover:bg-[var(--bg-elevated)]'
                    }`}
                    style={isSelected ? {
                      background: `linear-gradient(to right, ${wear.color.includes('emerald') ? '#10b981, #34d399' : 
                                                      wear.color.includes('blue') ? '#3b82f6, #22d3ee' :
                                                      wear.color.includes('yellow') ? '#eab308, #fb923c' :
                                                      wear.color.includes('orange') ? '#f97316, #ef4444' :
                                                      '#dc2626, #dc2626'})`
                    } : {}}
                  >
                    <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                      {wear.short}
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-white/90' : 'text-[var(--text-tertiary)]'}`}>
                      {wear.label}
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                        <div className="w-2 h-2 rounded-full bg-current" style={{ color: wear.color.includes('emerald') ? '#10b981' : 
                                                                                      wear.color.includes('blue') ? '#3b82f6' :
                                                                                      wear.color.includes('yellow') ? '#eab308' :
                                                                                      wear.color.includes('orange') ? '#f97316' :
                                                                                      '#dc2626' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Button - More Prominent */}
          <button
            onClick={handleAddCustomItem}
            disabled={!customItemName.trim()}
            className={`w-full text-white px-6 py-4 rounded-lg flex items-center justify-center gap-2 font-semibold text-base transition-all duration-300 ${
              customItemName.trim()
                ? 'bg-gradient-to-r from-[var(--cs-orange)] to-[var(--cs-orange-bright)] hover:from-[var(--cs-orange-bright)] hover:to-[var(--cs-orange)] shadow-lg shadow-[var(--cs-orange)]/30 hover:shadow-[var(--cs-orange)]/50 hover:scale-[1.02]'
                : 'bg-[var(--bg-overlay)] cursor-not-allowed opacity-50'
            }`}
          >
            <Plus className="w-5 h-5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, AlertCircle, RefreshCw, Info, Package } from 'lucide-react';
import { getSessionId, getCachedUser } from '../utils/steamAuth';
import { ManualItemEntry } from './ManualItemEntry';
import { InventorySelector } from './InventorySelector';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import type { TradeOffer, TradeItem } from './types';
import { createOffer, updateOffer } from '../utils/offerApi';
import anyKnifeImg from 'figma:asset/03d9db583e449a92fde00c448df118b1af8d15e8.png';
import anyOffersImg from 'figma:asset/c7a308326a8c9c7e5c58132136efd031fa5d15a3.png';
import anyCasesImg from 'figma:asset/3e9bb08c27025418783d5bf1ca0e5e1be75f1a05.png';

const PLACEHOLDER_OPTIONS: Array<{ name: string; category: 'knife' | 'offers' | 'cases'; image: string }> = [
  { name: 'Any Knife', category: 'knife', image: anyKnifeImg },
  { name: 'Any Offers', category: 'offers', image: anyOffersImg },
  { name: 'Any Cases', category: 'cases', image: anyCasesImg }
];

interface CreateOfferModalProps {
  onClose: () => void;
  onCreateOffer: (offer: TradeOffer) => void;
}

export function CreateOfferModal({ onClose, onCreateOffer }: CreateOfferModalProps) {
  const [selectedOffering, setSelectedOffering] = useState<TradeItem[]>([]);
  const [selectedSeeking, setSelectedSeeking] = useState<TradeItem[]>([]);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'offering' | 'seeking' | 'review'>('offering');
  const [isCreating, setIsCreating] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [showInventorySelector, setShowInventorySelector] = useState(false);
  const [inventorySelectorMode, setInventorySelectorMode] = useState<'offering' | 'seeking'>('offering');

  // Check if we're editing an existing offer
  useEffect(() => {
    const editingOfferStr = localStorage.getItem('editingOffer');
    if (editingOfferStr) {
      try {
        const offer = JSON.parse(editingOfferStr);
        setEditingOfferId(offer.id);
        setSelectedOffering(offer.offering || []);
        setSelectedSeeking(offer.seeking || []);
        setNotes(offer.notes || '');
        localStorage.removeItem('editingOffer');
      } catch (error) {
        console.error('Failed to load editing offer:', error);
      }
    }
  }, []);

  const toggleItemOffering = (item: TradeItem) => {
    if (selectedOffering.find(i => i.id === item.id)) {
      setSelectedOffering(selectedOffering.filter(i => i.id !== item.id));
    } else {
      setSelectedOffering([...selectedOffering, item]);
    }
  };

  const toggleItemSeeking = (item: TradeItem) => {
    if (selectedSeeking.find(i => i.id === item.id)) {
      setSelectedSeeking(selectedSeeking.filter(i => i.id !== item.id));
    } else {
      setSelectedSeeking([...selectedSeeking, item]);
    }
  };

  const addPlaceholder = (placeholder: typeof PLACEHOLDER_OPTIONS[0]) => {
    const placeholderItem: TradeItem = {
      id: `placeholder-${Date.now()}`,
      name: placeholder.name,
      image: placeholder.image, // Save the image URL so it persists
      isPlaceholder: true,
      category: placeholder.category
    };
    setSelectedSeeking([...selectedSeeking, placeholderItem]);
  };

  const handleCreateOffer = async () => {
    setIsCreating(true);
    try {
      let createdOffer;
      if (editingOfferId) {
        // Update existing offer
        createdOffer = await updateOffer(editingOfferId, selectedOffering, selectedSeeking, notes || undefined);
      } else {
        // Create new offer
        createdOffer = await createOffer(selectedOffering, selectedSeeking, notes || undefined);
      }
      onCreateOffer(createdOffer);
      onClose();
    } catch (error) {
      console.error('Failed to save offer:', error);
      alert(error instanceof Error ? error.message : 'Failed to save offer. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInventorySelect = (items: TradeItem[]) => {
    if (inventorySelectorMode === 'offering') {
      setSelectedOffering([...selectedOffering, ...items]);
    } else {
      setSelectedSeeking([...selectedSeeking, ...items]);
    }
    setShowInventorySelector(false);
  };

  const openInventorySelector = (mode: 'offering' | 'seeking') => {
    setInventorySelectorMode(mode);
    setShowInventorySelector(true);
  };

  // Get current user
  const currentUser = getCachedUser();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="border-b border-[var(--bg-elevated)] p-6 flex items-center justify-between">
          <h2 className="text-3xl">
            {editingOfferId ? 'Edit' : 'Create'} <span className="text-gradient-orange">Trade Offer</span>
          </h2>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Steps */}
        <div className="border-b border-[var(--bg-elevated)] px-6 py-4 flex gap-4">
          <StepButton
            active={step === 'offering'}
            completed={selectedOffering.length > 0}
            onClick={() => setStep('offering')}
            label="1. What You're Offering"
          />
          <StepButton
            active={step === 'seeking'}
            completed={selectedSeeking.length > 0}
            onClick={() => setStep('seeking')}
            label="2. What You Want"
          />
          <StepButton
            active={step === 'review'}
            completed={false}
            onClick={() => setStep('review')}
            label="3. Review & Publish"
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {step === 'offering' && (
            <div>
              <h3 className="text-xl mb-4 text-[var(--text-secondary)]">
                What are you offering? ({selectedOffering.length} selected)
              </h3>
              
              {/* Import from Steam Button */}
              {currentUser && (
                <Button
                  onClick={() => openInventorySelector('offering')}
                  className="mb-6 bg-gradient-to-r from-[var(--electric-blue)] to-[#4c9eff] hover:from-[#00c4e6] hover:to-[var(--electric-blue)] text-white"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Import from Steam Inventory
                </Button>
              )}
              
              {/* Info Banner about Steam Auto-Fetch */}
              <div className="mb-6 p-4 bg-[#1a2332] border border-[var(--electric-blue)]/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[var(--electric-blue)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white mb-2">
                      <strong>🎮 Steam Inventory Import Available!</strong>
                    </p>
                    <p className="text-xs text-gray-300 mb-2">
                      Click "Import from Steam Inventory" to browse your CS2 items and select what you want to trade.
                      Your inventory must be set to Public in Steam Privacy Settings.
                    </p>
                    <p className="text-xs text-[var(--electric-blue)]">
                      💡 Or manually add items from the popular items selector below!
                    </p>
                  </div>
                </div>
              </div>
              
              <ManualItemEntry
                items={selectedOffering}
                onAddItem={(item) => setSelectedOffering([...selectedOffering, item])}
                onRemoveItem={(id) => setSelectedOffering(selectedOffering.filter(i => i.id !== id))}
                label="Items You're Offering"
              />
            </div>
          )}

          {step === 'seeking' && (
            <div>
              <h3 className="text-xl mb-4 text-[var(--text-secondary)]">
                What do you want in return? ({selectedSeeking.length} selected)
              </h3>
              
              <ManualItemEntry
                items={selectedSeeking}
                onAddItem={(item) => setSelectedSeeking([...selectedSeeking, item])}
                onRemoveItem={(id) => setSelectedSeeking(selectedSeeking.filter(i => i.id !== id))}
                label="Items You're Seeking"
              />
            </div>
          )}

          {step === 'review' && (
            <div>
              <h3 className="text-xl mb-6 text-[var(--text-secondary)]">Review Your Offer</h3>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="text-lg mb-3 text-[var(--cs-orange)]">You're Offering</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOffering.map(item => (
                      <div key={item.id} className="bg-[var(--bg-elevated)] p-3 rounded-lg">
                        <img src={item.image} alt={item.name} className="w-full h-24 object-contain mb-2" />
                        <p className="text-sm truncate">{item.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{item.wear}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg mb-3 text-[var(--electric-blue)]">You're Seeking</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedSeeking.map(item => (
                      <div key={item.id} className="bg-[var(--bg-elevated)] p-3 rounded-lg">
                        {item.isPlaceholder && item.category ? (
                          <>
                            <img src={PLACEHOLDER_OPTIONS.find(p => p.category === item.category)?.image} alt={item.name} className="w-full h-24 object-cover rounded mb-2" />
                            <p className="text-sm text-[var(--electric-blue)]">{item.name}</p>
                          </>
                        ) : (
                          <>
                            <img src={item.image} alt={item.name} className="w-full h-24 object-contain mb-2" />
                            <p className="text-sm truncate">{item.name}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">{item.wear}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">
                  Additional Notes (Optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any conditions, preferences, or notes about your trade..."
                  className="bg-[var(--bg-elevated)] border-[var(--bg-overlay)] text-[var(--text-primary)] min-h-[100px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--bg-elevated)] p-6 flex justify-between">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          
          <div className="flex gap-3">
            {step !== 'offering' && (
              <Button
                onClick={() => {
                  if (step === 'seeking') setStep('offering');
                  if (step === 'review') setStep('seeking');
                }}
                variant="outline"
              >
                Back
              </Button>
            )}
            
            {step !== 'review' ? (
              <Button
                onClick={() => {
                  if (step === 'offering' && selectedOffering.length > 0) setStep('seeking');
                  if (step === 'seeking' && selectedSeeking.length > 0) setStep('review');
                }}
                disabled={(step === 'offering' && selectedOffering.length === 0) || (step === 'seeking' && selectedSeeking.length === 0)}
                className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white"
              >
                Next Step
              </Button>
            ) : (
              <Button
                onClick={handleCreateOffer}
                disabled={isCreating}
                className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white glow-orange"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish Offer'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Selector Modal */}
      {showInventorySelector && currentUser && (
        <InventorySelector
          onClose={() => setShowInventorySelector(false)}
          onSelectItems={handleInventorySelect}
          steamId={currentUser.steamId}
          title={inventorySelectorMode === 'offering' ? 'Select Items to Offer' : 'Select Items You Want'}
        />
      )}
    </div>
  );
}

function StepButton({ active, completed, onClick, label }: { active: boolean; completed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg transition-all ${
        active
          ? 'bg-[var(--cs-orange)] text-white'
          : completed
          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--electric-blue)]'
          : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]'
      }`}
    >
      {label}
    </button>
  );
}

function InventoryItemCard({ item, selected, onToggle }: { item: TradeItem; selected: boolean; onToggle: () => void }) {
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
        <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--cs-orange)] rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
      
      <img src={item.image} alt={item.name} className="w-full h-24 object-contain mb-2" />
      <p className="text-xs truncate">{item.name}</p>
      <p className="text-xs text-[var(--text-tertiary)]">{item.wear}</p>
    </button>
  );
}
import React, { useState, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { getCachedUser } from '../utils/steamAuth';
import { ManualItemEntry } from './ManualItemEntry';
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


  // Get current user
  const currentUser = getCachedUser();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-[var(--bg-base)] to-[var(--bg-deep)] border border-[var(--bg-elevated)] rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden animate-scale-in shadow-2xl">
        {/* Header - Futuristic Design */}
        <div className="border-b border-[var(--bg-elevated)] bg-gradient-to-r from-[var(--bg-elevated)]/50 to-transparent p-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold">
            {editingOfferId ? 'Edit' : 'Create'} <span className="text-gradient-orange">Trade Offer</span>
          </h2>
          <Button 
            onClick={onClose} 
            variant="ghost" 
            size="sm"
            className="hover:bg-[var(--bg-elevated)] rounded-lg"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Steps - Futuristic Progress Indicator */}
        <div className="border-b border-[var(--bg-elevated)] bg-[var(--bg-elevated)]/30 px-6 py-4">
          <div className="flex items-center gap-4">
            <StepButton
              active={step === 'offering'}
              completed={selectedOffering.length > 0}
              onClick={() => setStep('offering')}
              label="1. What You're Offering"
              stepNumber={1}
            />
            <div className="flex-1 h-0.5 bg-[var(--bg-overlay)]">
              <div className={`h-full transition-all duration-300 ${
                step !== 'offering' ? 'bg-gradient-to-r from-[var(--cs-orange)] to-[var(--electric-blue)]' : ''
              }`} style={{ width: step === 'offering' ? '0%' : '100%' }} />
            </div>
            <StepButton
              active={step === 'seeking'}
              completed={selectedSeeking.length > 0}
              onClick={() => setStep('seeking')}
              label="2. What You Want"
              stepNumber={2}
            />
            <div className="flex-1 h-0.5 bg-[var(--bg-overlay)]">
              <div className={`h-full transition-all duration-300 ${
                step === 'review' ? 'bg-gradient-to-r from-[var(--cs-orange)] to-[var(--electric-blue)]' : ''
              }`} style={{ width: step === 'review' ? '100%' : '0%' }} />
            </div>
            <StepButton
              active={step === 'review'}
              completed={false}
              onClick={() => setStep('review')}
              label="3. Review & Publish"
              stepNumber={3}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {step === 'offering' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">
                  What are you offering?
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Add items you want to trade. Include wear condition for skins.
                </p>
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
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">
                  What do you want in return?
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Add items you're looking for. Include wear condition for skins.
                </p>
              </div>
              
              <ManualItemEntry
                items={selectedSeeking}
                onAddItem={(item) => setSelectedSeeking([...selectedSeeking, item])}
                onRemoveItem={(id) => setSelectedSeeking(selectedSeeking.filter(i => i.id !== id))}
                label="Items You're Seeking"
              />
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Review Your Offer</h3>
                <p className="text-sm text-[var(--text-secondary)]">Double-check everything before publishing</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border border-[var(--bg-overlay)] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--cs-orange)] to-[var(--cs-orange-bright)] flex items-center justify-center">
                      <span className="text-white text-sm font-bold">→</span>
                    </div>
                    <h4 className="text-lg font-bold text-[var(--cs-orange)]">You're Offering</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedOffering.length > 0 ? (
                      selectedOffering.map(item => (
                        <div key={item.id} className="bg-[var(--bg-deep)] border border-[var(--bg-overlay)] rounded-lg p-3 flex items-center gap-3">
                          {item.image && (
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-12 object-contain" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                            {item.wear && (
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.wear}</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No items</p>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border border-[var(--bg-overlay)] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--electric-blue)] to-cyan-400 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">←</span>
                    </div>
                    <h4 className="text-lg font-bold text-[var(--electric-blue)]">You're Seeking</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedSeeking.length > 0 ? (
                      selectedSeeking.map(item => (
                        <div key={item.id} className="bg-[var(--bg-deep)] border border-[var(--bg-overlay)] rounded-lg p-3 flex items-center gap-3">
                          {item.isPlaceholder && item.category ? (
                            <>
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
                                <img src={PLACEHOLDER_OPTIONS.find(p => p.category === item.category)?.image} alt={item.name} className="w-full h-12 object-cover" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-[var(--electric-blue)]">{item.name}</p>
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Placeholder</p>
                              </div>
                            </>
                          ) : (
                            <>
                              {item.image && (
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
                                  <img src={item.image} alt={item.name} className="w-full h-12 object-contain" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                                {item.wear && (
                                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.wear}</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No items</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)] border border-[var(--bg-overlay)] rounded-xl p-6">
                <label className="text-sm font-medium text-[var(--text-primary)] mb-3 block">
                  Additional Notes (Optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any conditions, preferences, or notes about your trade..."
                  className="bg-[var(--bg-deep)] border-[var(--bg-overlay)] text-[var(--text-primary)] min-h-[100px] focus:border-[var(--electric-blue)] focus:ring-2 focus:ring-[var(--electric-blue)]/20"
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

    </div>
  );
}

function StepButton({ active, completed, onClick, label, stepNumber }: { active: boolean; completed: boolean; onClick: () => void; label: string; stepNumber: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-6 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 ${
        active
          ? 'bg-gradient-to-r from-[var(--cs-orange)] to-[var(--cs-orange-bright)] text-white shadow-lg shadow-[var(--cs-orange)]/30'
          : completed
          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-2 border-[var(--electric-blue)]'
          : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] border-2 border-transparent hover:border-[var(--bg-overlay)]'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
        active ? 'bg-white/20 text-white' : completed ? 'bg-[var(--electric-blue)] text-white' : 'bg-[var(--bg-deep)] text-[var(--text-tertiary)]'
      }`}>
        {completed && !active ? '✓' : stepNumber}
      </div>
      <span className="font-medium">{label}</span>
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
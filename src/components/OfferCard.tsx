import React from 'react';
import { ArrowRight, Clock, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import type { TradeOffer, ItemRarity } from './types';
import anyKnifeImg from 'figma:asset/03d9db583e449a92fde00c448df118b1af8d15e8.png';
import anyOffersImg from 'figma:asset/c7a308326a8c9c7e5c58132136efd031fa5d15a3.png';
import anyCasesImg from 'figma:asset/3e9bb08c27025418783d5bf1ca0e5e1be75f1a05.png';

const RARITY_COLORS: Record<ItemRarity, string> = {
  consumer: 'var(--rarity-consumer)',
  industrial: 'var(--rarity-industrial)',
  milspec: 'var(--rarity-milspec)',
  restricted: 'var(--rarity-restricted)',
  classified: 'var(--rarity-classified)',
  covert: 'var(--rarity-covert)',
  gold: 'var(--rarity-gold)'
};

// Map placeholder names to their images
const PLACEHOLDER_MAP: Record<string, string> = {
  'Any Knife': anyKnifeImg,
  'Any Offers': anyOffersImg,
  'Any Cases': anyCasesImg
};

// Check if an item is a placeholder based on its name
function isPlaceholderItem(itemName: string): boolean {
  return itemName in PLACEHOLDER_MAP;
}

// Get the placeholder image for a given item name
function getPlaceholderImage(itemName: string): string | null {
  return PLACEHOLDER_MAP[itemName] || null;
}

interface OfferCardProps {
  offer: TradeOffer;
  onViewDetails?: (offer: TradeOffer) => void;
  isAuthenticated?: boolean;
}

export function OfferCard({ offer, onViewDetails, isAuthenticated = true }: OfferCardProps) {
  const timeAgo = getTimeAgo(offer.timestamp);

  return (
    <div className="bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-xl p-6 hover:border-[var(--cs-orange)] transition-all duration-300 group hover:glow-orange">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* User Info */}
        <div className="flex items-center gap-3 lg:w-48">
          <img
            src={offer.userAvatar}
            alt={offer.userName}
            className="w-12 h-12 rounded-full border-2 border-[var(--bg-elevated)]"
          />
          <div>
            <h4 className="text-lg">{offer.userName}</h4>
            <div className="flex items-center gap-1 text-sm text-[var(--text-tertiary)]">
              <Clock className="w-3 h-3" />
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>

        {/* Trade Items */}
        <div className="flex-1 flex flex-col md:flex-row items-center gap-6">
          {/* Offering */}
          <div className="flex-1">
            <p className="text-sm text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Offering</p>
            <div className="flex flex-wrap gap-3">
              {offer.offering.map(item => (
                <ItemDisplay key={item.id} item={item} />
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--cs-orange)] to-[var(--electric-blue)] flex items-center justify-center glow-orange">
              <ArrowRight className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Seeking */}
          <div className="flex-1">
            <p className="text-sm text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Seeking</p>
            <div className="flex flex-wrap gap-3">
              {offer.seeking.map(item => (
                <ItemDisplay key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 lg:w-48 justify-center">
          {isAuthenticated ? (
            <>
              <Button
                onClick={() => {
                  if (offer.userTradeUrl) {
                    window.open(offer.userTradeUrl, '_blank', 'noopener,noreferrer');
                  } else {
                    alert('This trader has not set up their trade URL yet.');
                  }
                }}
                disabled={!offer.userTradeUrl}
                className={offer.userTradeUrl 
                  ? "bg-[var(--electric-blue)] hover:bg-[var(--electric-blue-dim)] text-white w-full glow-blue"
                  : "bg-[var(--bg-overlay)] text-[var(--text-tertiary)] w-full cursor-not-allowed"
                }
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {offer.userTradeUrl ? 'Send Offer' : 'No Trade URL'}
              </Button>
              <Button
                onClick={() => onViewDetails?.(offer)}
                variant="outline"
                className="border-[var(--bg-overlay)] hover:border-[var(--electric-blue)] w-full"
              >
                View Details
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled
                className="bg-[var(--bg-overlay)] text-[var(--text-tertiary)] w-full cursor-not-allowed"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Sign In Required
              </Button>
              <Button
                onClick={() => onViewDetails?.(offer)}
                variant="outline"
                className="border-[var(--bg-overlay)] hover:border-[var(--electric-blue)] w-full"
              >
                View Details
              </Button>
            </>
          )}
        </div>
      </div>

      {offer.notes && (
        <div className="mt-4 pt-4 border-t border-[var(--bg-elevated)]">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="text-[var(--text-tertiary)]">Note:</span> {offer.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function ItemDisplay({ item }: { item: TradeOffer['offering'][0] }) {
  // Check if this is a placeholder based on the item name
  const placeholderImage = getPlaceholderImage(item.name);
  
  // If it's a placeholder, render it with the special placeholder style
  if (placeholderImage) {
    return (
      <div className="group/item relative">
        <div className="w-32 h-32 bg-[var(--bg-elevated)] rounded-lg border-2 border-dashed border-[var(--electric-blue)] overflow-hidden hover:border-[var(--cs-orange)] transition-all duration-300 hover:scale-105">
          <img
            src={placeholderImage}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="mt-2 text-center">
          <p className="text-sm text-[var(--electric-blue)] uppercase tracking-wide">{item.name}</p>
        </div>
      </div>
    );
  }

  // Otherwise render as a regular item
  const borderColor = item.rarity ? RARITY_COLORS[item.rarity] : 'var(--bg-elevated)';

  return (
    <div className="group/item relative">
      <div
        className="w-32 h-32 bg-[var(--bg-elevated)] rounded-lg border-2 overflow-hidden hover:scale-105 transition-all duration-300"
        style={{ borderColor }}
      >
        {item.image && (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-contain p-2"
          />
        )}
      </div>
      <div className="mt-2">
        <p className="text-sm truncate max-w-[128px]">{item.name}</p>
        {item.wear && (
          <p className="text-xs text-[var(--text-tertiary)]">{item.wear}</p>
        )}
        {item.float !== undefined && (
          <p className="text-xs text-[var(--text-tertiary)] mono">Float: {item.float.toFixed(4)}</p>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
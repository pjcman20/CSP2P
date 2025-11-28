import { useState } from 'react';
import { X, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { updateTradeUrl } from '../utils/steamAuth';

interface TradeUrlModalProps {
  onClose: () => void;
  currentTradeUrl?: string | null;
  onUpdate: (tradeUrl: string) => void;
  requiredForOffer?: boolean;
  onSet?: () => void; // Called after successfully setting trade URL when requiredForOffer is true
}

export function TradeUrlModal({ onClose, currentTradeUrl, onUpdate, requiredForOffer = false, onSet }: TradeUrlModalProps) {
  const [tradeUrl, setTradeUrl] = useState(currentTradeUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!tradeUrl.trim()) {
      setError('Please enter your trade URL');
      return;
    }

    // Validate format
    const tradeUrlPattern = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+$/;
    if (!tradeUrlPattern.test(tradeUrl.trim())) {
      setError('Invalid trade URL format. Please copy the complete URL from Steam.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTradeUrl(tradeUrl.trim());
      onUpdate(tradeUrl.trim());
      
      // If requiredForOffer and onSet callback exists, call it instead of just closing
      if (requiredForOffer && onSet) {
        onSet();
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trade URL');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-xl max-w-2xl w-full animate-scale-in">
        {/* Header */}
        <div className="border-b border-[var(--bg-elevated)] p-6 flex items-center justify-between">
          <h2 className="text-2xl">
            Set Your <span className="text-gradient-orange">Steam Trade URL</span>
          </h2>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {requiredForOffer && (
            <div className="bg-[var(--cs-orange)]/10 border border-[var(--cs-orange)] rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--cs-orange)] flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-[var(--cs-orange)] mb-1">Trade URL Required</p>
                  <p className="text-[var(--text-secondary)]">You need to set your Steam Trade URL before creating offers. This allows other traders to send you trade offers on Steam.</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[var(--bg-elevated)] border border-[var(--electric-blue)] rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--electric-blue)] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--text-secondary)]">
                <p className="mb-2">Your Steam Trade URL allows other traders to send you trade offers directly through Steam.</p>
                <p>Without this URL, other users won't be able to initiate trades with you.</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg mb-3">How to find your Trade URL:</h3>
            <ol className="space-y-2 text-sm text-[var(--text-secondary)] list-decimal list-inside">
              <li>Open Steam and go to your Inventory</li>
              <li>Click on "Trade Offers" in the right sidebar</li>
              <li>Click "Who can send me Trade Offers?"</li>
              <li>Scroll down to "Third-Party Sites"</li>
              <li>Copy your Trade URL</li>
            </ol>
            <a 
              href="https://steamcommunity.com/id/me/tradeoffers/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--electric-blue)] hover:underline mt-3"
            >
              <ExternalLink className="w-4 h-4" />
              Open Steam Trade URL Settings
            </a>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="text-sm text-[var(--text-secondary)] mb-2 block">
                Steam Trade URL
              </label>
              <input
                type="text"
                value={tradeUrl}
                onChange={(e) => setTradeUrl(e.target.value)}
                placeholder="https://steamcommunity.com/tradeoffer/new/?partner=XXXXX&token=XXXXX"
                className="w-full bg-[var(--bg-elevated)] border border-[var(--bg-overlay)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--cs-orange)] focus:outline-none"
              />
              {error && (
                <p className="text-sm text-[var(--danger)] mt-2">{error}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button onClick={onClose} variant="outline" type="button">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white"
              >
                {isSubmitting ? 'Saving...' : 'Save Trade URL'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
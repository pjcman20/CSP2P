import { X, MessageCircle, Eye, Calendar, ArrowRight, ExternalLink, Flag, ThumbsUp, ThumbsDown, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import type { TradeOffer, ItemRarity } from './types';
import anyKnifeImg from 'figma:asset/03d9db583e449a92fde00c448df118b1af8d15e8.png';
import anyOffersImg from 'figma:asset/c7a308326a8c9c7e5c58132136efd031fa5d15a3.png';
import anyCasesImg from 'figma:asset/3e9bb08c27025418783d5bf1ca0e5e1be75f1a05.png';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { getSessionId, getCachedUser } from '../utils/steamAuth';
import { getReputation, submitReputationVote, getReputationBadge, type ReputationData } from '../utils/reputationApi';
import { toast } from 'sonner';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e2cf3727`;

const RARITY_COLORS: Record<ItemRarity, string> = {
  consumer: 'var(--rarity-consumer)',
  industrial: 'var(--rarity-industrial)',
  milspec: 'var(--rarity-milspec)',
  restricted: 'var(--rarity-restricted)',
  classified: 'var(--rarity-classified)',
  covert: 'var(--rarity-covert)',
  gold: 'var(--rarity-gold)'
};

const PLACEHOLDER_IMAGES = {
  knife: anyKnifeImg,
  offers: anyOffersImg,
  cases: anyCasesImg
};

interface OfferDetailViewProps {
  offer: TradeOffer;
  onClose: () => void;
  isAuthenticated?: boolean;
}

export function OfferDetailView({ offer, onClose, isAuthenticated = true }: OfferDetailViewProps) {
  const [replyText, setReplyText] = useState('');
  const [views, setViews] = useState(offer.views || 0);
  const [uniqueViewers, setUniqueViewers] = useState(offer.uniqueViewers?.length || 0);
  const [reputationData, setReputationData] = useState<ReputationData | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const currentUser = getCachedUser();

  // Track view when component mounts
  useEffect(() => {
    const trackView = async () => {
      try {
        const sessionId = getSessionId();
        const headers: HeadersInit = {
          'Authorization': `Bearer ${publicAnonKey}`,
        };
        
        if (sessionId) {
          headers['X-Session-ID'] = sessionId;
        }

        const response = await fetch(`${SERVER_URL}/offers/${offer.id}/view`, {
          method: 'POST',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setViews(data.views);
          setUniqueViewers(data.uniqueViewers);
        }
      } catch (error) {
        console.error('Failed to track view:', error);
      }
    };

    trackView();
  }, [offer.id]);

  // Fetch reputation data
  useEffect(() => {
    const fetchReputation = async () => {
      try {
        const data = await getReputation(offer.userId);
        setReputationData(data);
      } catch (error) {
        console.error('Failed to fetch reputation:', error);
      }
    };

    fetchReputation();
  }, [offer.userId]);

  const handleReputationVote = async (voteType: 'completed' | 'reversed') => {
    if (!currentUser) {
      toast.error('Sign in to vote on trader reputation');
      return;
    }

    if (currentUser.steamId === offer.userId) {
      toast.error('Cannot vote for your own offers');
      return;
    }

    setIsVoting(true);
    try {
      await submitReputationVote(offer.userId, voteType);
      // Refresh reputation data
      const updatedData = await getReputation(offer.userId);
      setReputationData(updatedData);
      toast.success(voteType === 'completed' ? '✅ Marked as completed trade' : '⚠️ Marked as reversed trade');
    } catch (error) {
      console.error('Failed to submit vote:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 2592000)} months ago`;
  };

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      {/* Background with CS map image */}
      <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&q=80')`
      }}>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(rgba(255, 106, 0, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 106, 0, 0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--bg-elevated)]">
          <div className="flex items-center gap-4">
            <img
              src={offer.userAvatar}
              alt={offer.userName}
              className="w-16 h-16 rounded-full border-4 border-[var(--cs-orange)] glow-orange"
            />
            <div>
              <h2 className="text-3xl">
                <span className="text-[var(--cs-orange)]">{offer.userName}</span>
                <span className="text-[var(--text-secondary)]"> wants to trade:</span>
              </h2>
            </div>
          </div>
          
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-[var(--text-primary)] hover:text-[var(--cs-orange)]"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Main Trade Display */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Trade Items Grid */}
            <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-8 items-start">
              {/* Offering Side */}
              <div className="flex flex-col">
                <h3 className="text-2xl mb-4 text-center">
                  <span className="text-[var(--cs-orange)]">Offering</span>
                  <span className="text-[var(--text-tertiary)] text-lg ml-2">({offer.offering.length} items)</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {offer.offering.map((item, index) => (
                    <DetailItemCard key={item.id} item={item} index={index} />
                  ))}
                </div>
              </div>

              {/* Center Arrow */}
              <div className="flex flex-col items-center justify-center gap-4 lg:pt-16">
                <div className="relative">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-r from-[var(--cs-orange)] to-[var(--electric-blue)] flex items-center justify-center glow-orange">
                    <ArrowRight className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[var(--bg-base)] rounded-full flex items-center justify-center border-2 border-[var(--cs-orange)]">
                    <ArrowRight className="w-4 h-4 text-[var(--cs-orange)]" />
                  </div>
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-[var(--bg-base)] rounded-full flex items-center justify-center border-2 border-[var(--cs-orange)]">
                    <ArrowRight className="w-4 h-4 text-[var(--cs-orange)] rotate-180" />
                  </div>
                </div>
              </div>

              {/* Seeking Side */}
              <div className="flex flex-col">
                <h3 className="text-2xl mb-4 text-center">
                  <span className="text-[var(--electric-blue)]">Seeking</span>
                  <span className="text-[var(--text-tertiary)] text-lg ml-2">({offer.seeking.length} items)</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {offer.seeking.map((item, index) => (
                    <DetailItemCard key={item.id} item={item} index={index} />
                  ))}
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {offer.notes && (
              <div className="mt-8 max-w-4xl mx-auto bg-[var(--bg-base)]/80 border border-[var(--bg-elevated)] rounded-lg p-6 backdrop-blur-sm">
                <h4 className="text-lg mb-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-[var(--cs-orange)]" />
                  <span className="text-[var(--cs-orange)]">Trade Notes:</span>
                </h4>
                <p className="text-[var(--text-secondary)] leading-relaxed">{offer.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="border-t border-[var(--bg-elevated)] bg-[var(--bg-base)]/80 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="grid grid-cols-3 gap-6">
              <StatItem
                icon={<Eye className="w-6 h-6 text-[var(--cs-orange)]" />}
                value={views}
                label="Total Views"
              />
              <StatItem
                icon={<Eye className="w-6 h-6 text-[var(--electric-blue)]" />}
                value={uniqueViewers}
                label="Unique Viewers"
              />
              <StatItem
                icon={<Calendar className="w-6 h-6 text-[var(--cs-orange)]" />}
                value={getTimeSince(offer.timestamp)}
                label={formatDate(offer.timestamp)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-[var(--bg-elevated)] px-6 py-4">
            <div className="container mx-auto flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Button
                    onClick={() => {
                      if (offer.userTradeUrl) {
                        window.open(offer.userTradeUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        alert('This trader has not set up their trade URL yet. They need to add it in their settings.');
                      }
                    }}
                    disabled={!offer.userTradeUrl}
                    className={offer.userTradeUrl
                      ? "bg-[var(--electric-blue)] hover:bg-[var(--electric-blue-dim)] text-white px-8 py-6 text-lg glow-blue"
                      : "bg-[var(--bg-overlay)] text-[var(--text-tertiary)] px-8 py-6 text-lg cursor-not-allowed"
                    }
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    {offer.userTradeUrl ? 'Send Trade Offer on Steam' : 'Trader Has No Trade URL'}
                  </Button>
                  
                  <Button
                    onClick={() => {
                      if (offer.userProfileUrl) {
                        window.open(offer.userProfileUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        alert('Steam profile not available.');
                      }
                    }}
                    variant="outline"
                    className="border-[var(--cs-orange)] text-[var(--cs-orange)] hover:bg-[var(--cs-orange)] hover:text-white px-8 py-6 text-lg"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Message Trader
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    disabled
                    className="bg-[var(--bg-overlay)] text-[var(--text-tertiary)] px-8 py-6 text-lg cursor-not-allowed"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Sign In to Send Offer
                  </Button>
                  
                  <div className="bg-[var(--bg-elevated)]/60 border border-[var(--cs-orange)] rounded-lg px-6 py-3">
                    <p className="text-[var(--text-secondary)]">
                      <span className="text-[var(--cs-orange)]">Sign in with Steam</span> to interact with offers
                    </p>
                  </div>
                </>
              )}

              <div className="flex-1"></div>

              <Button
                variant="outline"
                className="border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
              >
                <Flag className="w-4 h-4 mr-2" />
                Report
              </Button>
            </div>
          </div>

          {/* Reply Section */}
          {isAuthenticated && (
            <div className="border-t border-[var(--bg-elevated)] px-6 py-4">
              <div className="container mx-auto">
                <h4 className="text-lg mb-3 text-[var(--text-secondary)]">Leave a Comment</h4>
                <div className="flex gap-3">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Ask questions or make a counter-offer..."
                    className="bg-[var(--bg-elevated)] border-[var(--bg-overlay)] text-[var(--text-primary)]"
                    rows={2}
                  />
                  <Button
                    className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white"
                  >
                    Post
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reputation Section */}
          {reputationData && (
            <div className="border-t border-[var(--bg-elevated)] px-6 py-4 bg-[var(--bg-elevated)]/30">
              <div className="container mx-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg mb-2 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[var(--electric-blue)]" />
                      <span className="text-[var(--text-secondary)]">Trader Reputation</span>
                    </h4>
                    {reputationData.totalVotes > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`px-4 py-2 rounded-lg border-2 ${getReputationBadge(reputationData).color === 'text-green-400' ? 'border-green-400 bg-green-400/10' : getReputationBadge(reputationData).color === 'text-yellow-400' ? 'border-yellow-400 bg-yellow-400/10' : 'border-red-400 bg-red-400/10'}`}>
                            <p className={`text-2xl ${getReputationBadge(reputationData).color}`}>
                              {getReputationBadge(reputationData).emoji} {reputationData.completionRate}%
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
                              {getReputationBadge(reputationData).label}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <p className="text-green-400">{reputationData.completed} completed</p>
                          </div>
                          <div>
                            <p className="text-red-400">{reputationData.reversed} reversed</p>
                          </div>
                          <div>
                            <p className="text-[var(--text-tertiary)]">{reputationData.totalVotes} total votes</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-tertiary)]">No reputation data yet</p>
                    )}
                  </div>
                  
                  {currentUser && currentUser.steamId !== offer.userId && (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-[var(--text-tertiary)] mr-2">Rate this trader:</p>
                      <Button
                        onClick={() => handleReputationVote('completed')}
                        disabled={isVoting || reputationData.userVote === 'completed'}
                        variant="outline"
                        className={reputationData.userVote === 'completed' 
                          ? 'border-green-400 text-green-400 bg-green-400/10' 
                          : 'border-green-400 text-green-400 hover:bg-green-400 hover:text-white'
                        }
                      >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Trade Completed
                      </Button>
                      <Button
                        onClick={() => handleReputationVote('reversed')}
                        disabled={isVoting || reputationData.userVote === 'reversed'}
                        variant="outline"
                        className={reputationData.userVote === 'reversed' 
                          ? 'border-red-400 text-red-400 bg-red-400/10' 
                          : 'border-red-400 text-red-400 hover:bg-red-400 hover:text-white'
                        }
                      >
                        <ThumbsDown className="w-4 h-4 mr-2" />
                        Trade Reversed
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItemCard({ item, index }: { item: TradeOffer['offering'][0]; index: number }) {
  const isPlaceholder = item.isPlaceholder && item.category;
  const borderColor = !isPlaceholder && item.rarity ? RARITY_COLORS[item.rarity] : 'var(--bg-elevated)';

  return (
    <div
      className="relative bg-[var(--bg-base)]/80 backdrop-blur-sm rounded-lg border-2 p-4 hover:scale-105 transition-all animate-scale-in"
      style={{
        borderColor: isPlaceholder ? 'var(--electric-blue)' : borderColor,
        animationDelay: `${index * 0.05}s`
      }}
    >
      {/* Item Image */}
      <div className="w-full h-32 flex items-center justify-center mb-3">
        {isPlaceholder && item.category ? (
          <img
            src={PLACEHOLDER_IMAGES[item.category]}
            alt={item.name}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Item Info */}
      <div className="text-center">
        <p className={`text-sm mb-1 ${isPlaceholder ? 'text-[var(--electric-blue)] uppercase tracking-wide' : ''}`}>
          {item.name}
        </p>
        {!isPlaceholder && (
          <>
            {item.wear && (
              <p className="text-xs text-[var(--text-tertiary)] mb-1">{item.wear}</p>
            )}
            {item.float !== undefined && (
              <p className="text-xs text-[var(--text-tertiary)] mono">
                Float: {item.float.toFixed(4)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Rarity Glow Effect */}
      {!isPlaceholder && item.rarity && (
        <div
          className="absolute inset-0 rounded-lg opacity-20 pointer-events-none"
          style={{
            boxShadow: `0 0 20px ${borderColor}, inset 0 0 20px ${borderColor}`
          }}
        ></div>
      )}
    </div>
  );
}

function StatItem({ icon, value, label }: {
  icon?: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && <div>{icon}</div>}
      <div>
        <p className="text-2xl mono">{value}</p>
        <p className="text-sm text-[var(--text-tertiary)]">{label}</p>
      </div>
    </div>
  );
}
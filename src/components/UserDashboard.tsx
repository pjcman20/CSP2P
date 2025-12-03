import { ArrowLeft, Edit, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import type { Page } from '../App';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { getAccessToken } from '../utils/supabaseClient';
import type { TradeOffer } from './types';
import { subscribeToUserOffers } from '../utils/realtimeSubscription';
import { toast } from 'sonner@2.0.3';
import { DeleteOfferDialog } from './DeleteOfferDialog';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e2cf3727`;

interface UserDashboardProps {
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  steamUser?: any;
}

export function UserDashboard({ onNavigate, steamUser }: UserDashboardProps) {
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<TradeOffer | null>(null);

  useEffect(() => {
    fetchMyOffers();
  }, []);

  const fetchMyOffers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use Supabase Auth token instead of session ID
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('Not authenticated. Please sign in.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${SERVER_URL}/offers/user/mine`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Not authenticated. Please sign in.');
        } else {
          throw new Error('Failed to fetch offers');
        }
        return;
      }

      const data = await response.json();
      setOffers(data.offers || []);
    } catch (err) {
      console.error('Error fetching offers:', err);
      setError('Failed to load your offers');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (offer: TradeOffer) => {
    setOfferToDelete(offer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!offerToDelete) return;

    try {
      setDeleting(offerToDelete.id);
      
      // Use Supabase Auth token instead of session ID
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error('Not authenticated. Please sign in.');
        setDeleting(null);
        setDeleteDialogOpen(false);
        setOfferToDelete(null);
        return;
      }
      
      const response = await fetch(`${SERVER_URL}/offers/${offerToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Not authenticated. Please sign in.');
        } else {
          throw new Error('Failed to delete offer');
        }
        return;
      }

      // Remove from local state
      setOffers(offers.filter(o => o.id !== offerToDelete.id));
      toast.success('Offer deleted successfully');
      setDeleteDialogOpen(false);
      setOfferToDelete(null);
    } catch (err) {
      console.error('Error deleting offer:', err);
      toast.error('Failed to delete offer. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setOfferToDelete(null);
  };

  const handleEdit = (offer: TradeOffer) => {
    // Store the offer to edit in localStorage
    localStorage.setItem('editingOffer', JSON.stringify(offer));
    // Navigate back to marketplace (which will open the create modal in edit mode)
    onNavigate('marketplace');
  };

  // Calculate stats
  const activeOffers = offers.filter(o => o.status === 'active').length;
  const totalViews = offers.reduce((sum, o) => sum + (o.views || 0), 0);
  const totalUniqueViewers = offers.reduce((sum, o) => sum + (o.uniqueViewers?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-deep)] via-[var(--bg-base)] to-[var(--bg-deep)]">
      {/* Header */}
      <header className="border-b border-[var(--bg-elevated)] bg-[var(--bg-base)]/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => onNavigate('marketplace')}
              variant="ghost"
              className="text-[var(--text-secondary)]"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Trading Hub
            </Button>
            
            {steamUser && (
              <div className="flex items-center gap-3">
                <img
                  src={steamUser.avatarUrl}
                  alt={steamUser.personaName}
                  className="w-10 h-10 rounded-full border-2 border-[var(--cs-orange)]"
                />
                <span className="text-[var(--text-primary)]">{steamUser.personaName}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <h2 className="text-4xl mb-8">
          My <span className="text-gradient-orange">Dashboard</span>
        </h2>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <StatCard label="Active Offers" value={activeOffers} color="var(--cs-orange)" />
          <StatCard label="Total Views" value={totalViews} color="var(--electric-blue)" />
          <StatCard label="Unique Viewers" value={totalUniqueViewers} color="var(--success)" />
        </div>

        {/* My Offers */}
        <div>
          <h3 className="text-2xl mb-6">Your Active Offers</h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--cs-orange)]" />
            </div>
          ) : error ? (
            <div className="bg-[var(--bg-base)] border border-[var(--danger)] rounded-xl p-6 text-center">
              <p className="text-[var(--danger)]">{error}</p>
            </div>
          ) : offers.length === 0 ? (
            <div className="bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-xl p-12 text-center">
              <p className="text-[var(--text-secondary)] mb-4">You haven't created any offers yet.</p>
              <Button
                onClick={() => onNavigate('marketplace')}
                className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white"
              >
                Create Your First Offer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {offers.map(offer => (
                <div
                  key={offer.id}
                  className="bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-xl p-6 hover:border-[var(--cs-orange)] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <div>
                          <span className="text-[var(--text-secondary)] text-sm">Offering:</span>
                          <p className="text-lg">
                            {offer.offering.map(item => item.name).join(', ')}
                          </p>
                        </div>
                        <span className="text-[var(--text-tertiary)]">→</span>
                        <div>
                          <span className="text-[var(--text-secondary)] text-sm">Seeking:</span>
                          <p className="text-lg text-[var(--electric-blue)]">
                            {offer.seeking.map(item => item.name).join(', ')}
                          </p>
                        </div>
                      </div>
                      
                      {offer.notes && (
                        <p className="text-sm text-[var(--text-tertiary)] mb-2 italic">
                          "{offer.notes}"
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{offer.views || 0} views</span>
                        </div>
                        <span>•</span>
                        <span>{offer.uniqueViewers?.length || 0} unique viewers</span>
                        <span>•</span>
                        <span>{getTimeAgo(offer.timestamp)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[var(--electric-blue)] text-[var(--electric-blue)] hover:bg-[var(--electric-blue)] hover:text-white"
                        onClick={() => handleEdit(offer)}
                        title="Edit offer"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
                        onClick={() => handleDeleteClick(offer)}
                        disabled={deleting === offer.id}
                        title="Delete offer"
                      >
                        {deleting === offer.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteOfferDialog
        isOpen={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        offerName={offerToDelete ? `${offerToDelete.offering.map(i => i.name).join(', ')} → ${offerToDelete.seeking.map(i => i.name).join(', ')}` : undefined}
        isLoading={deleting !== null}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-xl p-6">
      <p className="text-[var(--text-secondary)] text-sm mb-2">{label}</p>
      <p className="text-4xl mono" style={{ color }}>{value}</p>
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
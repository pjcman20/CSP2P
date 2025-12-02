import type { TradeOffer } from '../components/types';
import { getAllOffers } from './offerApi';

type NewOfferCallback = (newOffer: TradeOffer) => void;

/**
 * Simple polling-based subscription for offers
 * This is a fallback when Supabase Realtime isn't enabled
 */
export function subscribeToOffersPolling(
  onNewOffer: NewOfferCallback,
  intervalMs: number = 30000 // Poll every 30 seconds (reduced from 3s to prevent REST request spam)
) {
  console.log('🔄 Setting up polling subscription for offers (every', intervalMs, 'ms)...');
  
  let lastOfferIds: string[] = [];
  let isFirstFetch = true;

  const poll = async () => {
    try {
      const offers = await getAllOffers();
      const currentOfferIds = offers.map(o => o.id);
      
      // Check if there are new offers
      if (!isFirstFetch) {
        const newOfferIds = currentOfferIds.filter(id => !lastOfferIds.includes(id));
        if (newOfferIds.length > 0) {
          console.log('✨ Detected', newOfferIds.length, 'new offer(s) via polling');
          // Call callback for each new offer
          newOfferIds.forEach(id => {
            const newOffer = offers.find(o => o.id === id);
            if (newOffer) {
              onNewOffer(newOffer);
            }
          });
        }
      } else {
        // First fetch, just set the initial state
        console.log('🔄 Initial polling fetch:', offers.length, 'offers');
        isFirstFetch = false;
      }
      
      lastOfferIds = currentOfferIds;
    } catch (error) {
      console.error('Error polling offers:', error);
    }
  };

  // Initial poll
  poll();
  
  // Set up interval
  const intervalId = setInterval(poll, intervalMs);

  // Return unsubscribe function
  return () => {
    console.log('🔄 Stopping polling subscription');
    clearInterval(intervalId);
  };
}
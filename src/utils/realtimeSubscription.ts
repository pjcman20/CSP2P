import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './supabase/info';
import type { TradeOffer } from '../components/types';

const SUPABASE_URL = `https://${projectId}.supabase.co`;

// Create Supabase client for realtime subscriptions
const supabase = createClient(SUPABASE_URL, publicAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload {
  eventType: RealtimeEvent;
  new: any;
  old: any;
}

/**
 * Subscribe to real-time changes on the offers table
 */
export function subscribeToOffers(
  onInsert?: (offer: TradeOffer) => void,
  onUpdate?: (offer: TradeOffer) => void,
  onDelete?: (offerId: string) => void
) {
  console.log('🔴 Setting up real-time subscription for offers...');

  const channel = supabase
    .channel('offers-channel')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'kv_store_e2cf3727',
      },
      (payload: any) => {
        console.log('📡 Real-time event received:', payload);

        try {
          // Filter for offer keys in the handler
          const key = payload.new?.key || payload.old?.key;
          if (!key || !key.startsWith('offer:')) {
            console.log('⏭️ Skipping non-offer key:', key);
            return;
          }

          if (payload.eventType === 'INSERT') {
            // New offer created
            const value = payload.new.value;
            if (value && onInsert) {
              const offer = typeof value === 'string' ? JSON.parse(value) : value;
              console.log('✨ New offer inserted:', offer.id);
              onInsert(offer);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Offer updated
            const value = payload.new.value;
            if (value && onUpdate) {
              const offer = typeof value === 'string' ? JSON.parse(value) : value;
              console.log('🔄 Offer updated:', offer.id);
              onUpdate(offer);
            }
          } else if (payload.eventType === 'DELETE') {
            // Offer deleted
            if (key && onDelete) {
              const offerId = key.replace('offer:', '');
              console.log('🗑️ Offer deleted:', offerId);
              onDelete(offerId);
            }
          }
        } catch (error) {
          console.error('Error processing real-time event:', error);
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
    });

  // Return unsubscribe function
  return () => {
    console.log('🔴 Unsubscribing from offers channel...');
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to real-time changes for a specific user's offers
 */
export function subscribeToUserOffers(
  steamId: string,
  onInsert?: (offer: TradeOffer) => void,
  onUpdate?: (offer: TradeOffer) => void,
  onDelete?: (offerId: string) => void
) {
  console.log(`🔴 Setting up real-time subscription for user ${steamId} offers...`);

  const channel = supabase
    .channel(`user-offers-${steamId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kv_store_e2cf3727',
        filter: `key=like.offer:%`,
      },
      (payload: any) => {
        try {
          // Filter by steamId in the handler since we can't filter in the subscription
          const value = payload.new?.value || payload.old?.value;
          if (!value) return;

          const offer = typeof value === 'string' ? JSON.parse(value) : value;
          if (offer.userId !== steamId) return; // Only process this user's offers

          if (payload.eventType === 'INSERT' && onInsert) {
            console.log('✨ New user offer inserted:', offer.id);
            onInsert(offer);
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            console.log('🔄 User offer updated:', offer.id);
            onUpdate(offer);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            const key = payload.old.key;
            const offerId = key.replace('offer:', '');
            console.log('🗑️ User offer deleted:', offerId);
            onDelete(offerId);
          }
        } catch (error) {
          console.error('Error processing user real-time event:', error);
        }
      }
    )
    .subscribe();

  return () => {
    console.log(`🔴 Unsubscribing from user ${steamId} offers channel...`);
    supabase.removeChannel(channel);
  };
}

/**
 * Check if realtime is connected
 */
export function getRealtimeStatus() {
  const channels = supabase.getChannels();
  return {
    connected: channels.length > 0,
    channels: channels.map(ch => ch.topic),
  };
}
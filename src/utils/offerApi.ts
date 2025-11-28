import { projectId, publicAnonKey } from './supabase/info';
import { getSessionId } from './steamAuth';
import type { TradeOffer } from '../components/types';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e2cf3727`;

// Create a new offer
export async function createOffer(offering: any[], seeking: any[], notes?: string): Promise<TradeOffer> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  try {
    console.log('📤 FRONTEND: Sending offer to server:', { 
      offering: offering.map((item: any) => ({ 
        name: item.name, 
        isPlaceholder: item.isPlaceholder, 
        category: item.category 
      })),
      seeking: seeking.map((item: any) => ({ 
        name: item.name, 
        isPlaceholder: item.isPlaceholder, 
        category: item.category 
      }))
    });
    
    const response = await fetch(`${SERVER_URL}/offers/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offering, seeking, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create offer');
    }

    const data = await response.json();
    return data.offer;
  } catch (error) {
    console.error('Error creating offer:', error);
    throw error;
  }
}

// Update an existing offer
export async function updateOffer(offerId: string, offering: any[], seeking: any[], notes?: string): Promise<TradeOffer> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${SERVER_URL}/offers/${offerId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offering, seeking, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update offer');
    }

    const data = await response.json();
    return data.offer;
  } catch (error) {
    console.error('Error updating offer:', error);
    throw error;
  }
}

// Get all active offers
export async function getAllOffers(): Promise<TradeOffer[]> {
  try {
    const response = await fetch(`${SERVER_URL}/offers/list`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch offers');
    }

    const data = await response.json();
    return data.offers || [];
  } catch (error) {
    console.error('Error fetching offers:', error);
    throw error;
  }
}

// Get single offer by ID
export async function getOfferById(offerId: string): Promise<TradeOffer | null> {
  try {
    const response = await fetch(`${SERVER_URL}/offers/${offerId}`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.offer;
  } catch (error) {
    console.error('Error fetching offer:', error);
    return null;
  }
}

// Get user's own offers
export async function getMyOffers(): Promise<TradeOffer[]> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${SERVER_URL}/offers/user/mine`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch offers');
    }

    const data = await response.json();
    return data.offers || [];
  } catch (error) {
    console.error('Error fetching user offers:', error);
    throw error;
  }
}

// Delete an offer
export async function deleteOffer(offerId: string): Promise<void> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${SERVER_URL}/offers/${offerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete offer');
    }
  } catch (error) {
    console.error('Error deleting offer:', error);
    throw error;
  }
}

// Send trade request
export async function sendTradeRequest(offerId: string, message?: string): Promise<any> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${SERVER_URL}/offers/${offerId}/request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send trade request');
    }

    const data = await response.json();
    return data.request;
  } catch (error) {
    console.error('Error sending trade request:', error);
    throw error;
  }
}

// Get trade requests received
export async function getTradeRequests(): Promise<any[]> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${SERVER_URL}/requests/received`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch trade requests');
    }

    const data = await response.json();
    return data.requests || [];
  } catch (error) {
    console.error('Error fetching trade requests:', error);
    throw error;
  }
}
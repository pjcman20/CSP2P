import { projectId, publicAnonKey } from './supabase/info';
import { getSessionId } from './steamAuth';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e2cf3727`;

export interface ReputationData {
  completed: number;
  reversed: number;
  totalVotes: number;
  completionRate: number;
  userVote?: 'completed' | 'reversed' | null;
}

/**
 * Submit a reputation vote for a trader
 */
export async function submitReputationVote(
  targetSteamId: string,
  voteType: 'completed' | 'reversed'
): Promise<{ success: boolean; reputation: ReputationData }> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/reputation/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      'X-Session-ID': sessionId,
    },
    body: JSON.stringify({ targetSteamId, voteType }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit vote');
  }

  return response.json();
}

/**
 * Get reputation data for a specific trader
 */
export async function getReputation(steamId: string): Promise<ReputationData> {
  const sessionId = getSessionId();
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${publicAnonKey}`,
  };

  // Include session if available to check user's vote
  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
  }

  const response = await fetch(`${API_BASE_URL}/reputation/${steamId}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch reputation');
  }

  const data = await response.json();
  return data.reputation;
}

/**
 * Get reputation badge data for display
 */
export function getReputationBadge(reputation: ReputationData): {
  color: string;
  label: string;
  emoji: string;
} {
  const { completionRate, totalVotes } = reputation;

  if (totalVotes === 0) {
    return {
      color: 'text-gray-400',
      label: 'No Rep',
      emoji: '❓',
    };
  }

  if (completionRate >= 95) {
    return {
      color: 'text-green-400',
      label: 'Trusted',
      emoji: '✅',
    };
  }

  if (completionRate >= 80) {
    return {
      color: 'text-blue-400',
      label: 'Reliable',
      emoji: '👍',
    };
  }

  if (completionRate >= 60) {
    return {
      color: 'text-yellow-400',
      label: 'Moderate',
      emoji: '⚠️',
    };
  }

  return {
    color: 'text-red-400',
    label: 'Risky',
    emoji: '❌',
  };
}

export type ItemRarity = 'consumer' | 'industrial' | 'milspec' | 'restricted' | 'classified' | 'covert' | 'gold';

export interface TradeItem {
  id: string;
  name: string;
  wear?: string;
  float?: number;
  image?: string;
  rarity?: ItemRarity | string; // Allow any string for Steam's rarity format
  isPlaceholder?: boolean;
  category?: 'knife' | 'cases' | 'offers';
  price?: number; // Steam Market price in USD
  type?: string; // Item type from Steam
  statTrak?: boolean; // Is StatTrak™
  souvenir?: boolean; // Is Souvenir
  marketName?: string; // Market hash name from Steam
}

export interface TradeOffer {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userTradeUrl?: string | null;
  userProfileUrl?: string;
  offering: TradeItem[];
  seeking: TradeItem[];
  notes?: string;
  timestamp: number;
  status: 'active' | 'pending' | 'completed';
}
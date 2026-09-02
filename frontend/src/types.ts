export interface Token {
  symbol: string;
  name: string;
  priceUSD: number;
  balance?: number;
  iconBg?: string;
  address: string;
  decimals?: number;
  available?: boolean;
  verified?: boolean;
  chain?: string;
  change24h?: number;
  volume24h?: number;
}

export interface SwapState {
  sellToken: Token;
  buyToken: Token | null;
  sellAmount: string;
  buyAmount: string;
  slippage: number; // in percent
  deadline: number; // in minutes
  autoSlippage: boolean;
  isExactIn: boolean;
}

export type ActiveNavTab = 'Trade' | 'Explore' | 'Launches' | 'Pool' | 'Portfolio' | 'Vault';

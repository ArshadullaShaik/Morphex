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

export type ActiveNavTab = 'Home' | 'Trade' | 'Explore' | 'Pool' | 'Portfolio' | 'Vault' | 'Governance' | 'Docs';

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: 'Active' | 'Passed' | 'Queued' | 'Executed';
  startDate: string;
  endDate: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  category: 'Protocol' | 'Treasury' | 'FHEVM Relayer' | 'Security';
}

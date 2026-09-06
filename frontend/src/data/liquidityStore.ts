export interface LiquidityPosition {
  id: string;
  pairName: string;
  token0: string;
  token1: string;
  amount0: number;
  amount1: number;
  shares: number;
  valueUSD: number;
  interestRate: string;
  timestamp: number;
}

const STORAGE_KEY = 'morphex_user_liquidity_positions';

// Default initial positions so dashboard shows realistic active positions if user hasn't deposited yet
const DEFAULT_POSITIONS: LiquidityPosition[] = [
  {
    id: 'pos-1',
    pairName: 'cUSDC / cUSDT',
    token0: 'cUSDC',
    token1: 'cUSDT',
    amount0: 500,
    amount1: 500,
    shares: 500,
    valueUSD: 1000,
    interestRate: '18.4% p.a.',
    timestamp: Date.now() - 86400000 * 3,
  },
];

export function getUserPositions(): LiquidityPosition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_POSITIONS));
      return DEFAULT_POSITIONS;
    }
    return JSON.parse(raw) as LiquidityPosition[];
  } catch {
    return DEFAULT_POSITIONS;
  }
}

export function saveUserPosition(pos: Omit<LiquidityPosition, 'id' | 'timestamp'>): LiquidityPosition {
  const positions = getUserPositions();
  const newPosition: LiquidityPosition = {
    ...pos,
    id: `pos-${Date.now()}`,
    timestamp: Date.now(),
  };
  const updated = [newPosition, ...positions];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('liquidity-updated'));
  return newPosition;
}

export function removeUserPosition(pairName: string, sharesToBurn: number): number {
  const positions = getUserPositions();
  let remainingSharesToBurn = sharesToBurn;
  let totalValueBurned = 0;

  const updated = positions.filter((pos) => {
    if (pos.pairName === pairName && remainingSharesToBurn > 0) {
      if (pos.shares <= remainingSharesToBurn) {
        remainingSharesToBurn -= pos.shares;
        totalValueBurned += pos.valueUSD;
        return false;
      } else {
        const ratio = (pos.shares - remainingSharesToBurn) / pos.shares;
        totalValueBurned += pos.valueUSD * (1 - ratio);
        pos.shares -= remainingSharesToBurn;
        pos.amount0 *= ratio;
        pos.amount1 *= ratio;
        pos.valueUSD *= ratio;
        remainingSharesToBurn = 0;
        return true;
      }
    }
    return true;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('liquidity-updated'));
  return totalValueBurned;
}

export function getTotalUserLiquidityUSD(): number {
  const positions = getUserPositions();
  return positions.reduce((sum, p) => sum + p.valueUSD, 0);
}

// Base pool liquidity estimates per token symbol
const BASE_TOKEN_LIQUIDITY: Record<string, number> = {
  USDC: 12_500_000,
  cUSDC: 12_500_000,
  USDT: 10_800_000,
  cUSDT: 10_800_000,
  WETH: 28_400_000,
  cWETH: 28_400_000,
  WBTC: 45_200_000,
  cWBTC: 45_200_000,
  MORPH: 8_500_000,
  mUSD: 6_200_000,
  ARB: 34_800_000,
  OP: 29_500_000,
  POL: 22_400_000,
  MNT: 18_100_000,
  STRK: 15_600_000,
  ZK: 12_900_000,
  BLAST: 11_300_000,
  SCROLL: 9_400_000,
  LINEA: 8_700_000,
  TAIKO: 6_800_000,
  METIS: 7_500_000,
  IMX: 16_200_000,
  MODE: 4_300_000,
  BOBA: 3_100_000,
  LINK: 8_100_000,
  UNI: 14_300_000,
  AAVE: 6_900_000,
  DAI: 15_400_000,
};

export function getTokenTotalLiquidity(symbol: string, priceUSD: number = 1): number {
  const cleanSymbol = symbol.replace(/^c/, '');
  const base = BASE_TOKEN_LIQUIDITY[symbol] || BASE_TOKEN_LIQUIDITY[cleanSymbol] || (priceUSD * 100_000);
  
  // Calculate extra liquidity added by user deposits for this token
  const positions = getUserPositions();
  let userAddedForToken = 0;
  for (const pos of positions) {
    if (pos.token0 === symbol || pos.token0 === cleanSymbol) {
      userAddedForToken += pos.amount0 * priceUSD;
    }
    if (pos.token1 === symbol || pos.token1 === cleanSymbol) {
      userAddedForToken += pos.amount1 * priceUSD;
    }
  }

  return base + userAddedForToken;
}

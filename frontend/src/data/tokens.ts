import { Token } from '../types';
import { config, deployedTokens } from '../morphex';

export const COINGECKO_IDS: Record<string, string> = {
  USDT: 'tether', USDC: 'usd-coin', LINK: 'chainlink', SHIB: 'shiba-inu', UNI: 'uniswap',
  AAVE: 'aave', PEPE: 'pepe', MKR: 'maker', DAI: 'dai', LDO: 'lido-dao', ONDO: 'ondo-finance',
  ENA: 'ethena', WETH: 'weth', WBTC: 'wrapped-bitcoin', CRV: 'curve-dao-token', ARB: 'arbitrum',
  OP: 'optimism', POL: 'matic-network', GRT: 'the-graph', SAND: 'the-sandbox', MANA: 'decentraland',
  APE: 'apecoin', IMX: 'immutable-x', AXS: 'axie-infinity', COMP: 'compound-governance-token',
  SNX: 'havven', RPL: 'rocket-pool', ENS: 'ethereum-name-service', PAXG: 'pax-gold', FLOKI: 'floki',
};

export async function fetchTokenPrices(tokens: Token[]): Promise<Record<string, number>> {
  const ids = [...new Set(tokens.map((token) => COINGECKO_IDS[token.symbol.replace(/^c/, '')]).filter(Boolean))];
  if (ids.length === 0) return {};
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`);
  if (!response.ok) throw new Error(`Price service returned ${response.status}`);
  const prices = await response.json() as Record<string, { usd?: number }>;
  return Object.fromEntries(Object.entries(COINGECKO_IDS)
    .map(([symbol, id]) => [symbol, prices[id]?.usd])
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
}

const TOKEN_CATALOG = [
  ['USDT', 'Tether'], ['USDC', 'USD Coin'], ['LINK', 'Chainlink'], ['SHIB', 'Shiba Inu'],
  ['UNI', 'Uniswap'], ['AAVE', 'Aave'], ['PEPE', 'Pepe'], ['MKR', 'Maker'], ['DAI', 'Dai'],
  ['LDO', 'Lido DAO'], ['ONDO', 'Ondo'], ['ENA', 'Ethena'], ['WETH', 'Wrapped Ether'],
  ['WBTC', 'Wrapped Bitcoin'], ['CRV', 'Curve DAO'], ['ARB', 'Arbitrum'], ['OP', 'Optimism'],
  ['POL', 'Polygon'], ['GRT', 'The Graph'], ['SAND', 'The Sandbox'], ['MANA', 'Decentraland'],
  ['APE', 'ApeCoin'], ['IMX', 'Immutable'], ['AXS', 'Axie Infinity'], ['COMP', 'Compound'],
  ['SNX', 'Synthetix'], ['RPL', 'Rocket Pool'], ['ENS', 'Ethereum Name Service'],
  ['PAXG', 'Pax Gold'], ['FLOKI', 'FLOKI'],
] as const;

export const SUPPORTED_TOKENS: Token[] = TOKEN_CATALOG.map(([symbol, name]) => {
  const deployed = deployedTokens.find((token) => token.symbol === symbol || token.symbol === `c${symbol}`);
  return {
    symbol: deployed?.symbol ?? symbol,
    name: deployed?.name ?? name,
    address: deployed?.address ?? '',
    decimals: 6,
    priceUSD: 1,
    verified: Boolean(deployed),
    available: Boolean(deployed),
    chain: 'Sepolia',
  };
});

export const MORPH_TOKEN: Token = {
  symbol: 'MORPH',
  name: 'Morphex Token',
  priceUSD: 2.85,
  address: config.token0Address,
  decimals: 6,
  verified: true,
  chain: 'Morphex L2',
  change24h: 8.42,
  volume24h: 12_600_000,
};

export const MORPHEX_TOKENS: Token[] = [
  MORPH_TOKEN,
  {
    symbol: 'mUSD',
    name: 'Morphex USD',
    priceUSD: 1.00,
    address: config.token1Address,
    decimals: 6,
    verified: true,
    chain: 'Morphex L2',
    change24h: 0.12,
    volume24h: 6_450_000,
  },
];

export const L2_CHAIN_TOKENS: Token[] = [
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    priceUSD: 0.54,
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
    verified: true,
    chain: 'Arbitrum One',
    change24h: 3.45,
    volume24h: 84_200_000,
  },
  {
    symbol: 'OP',
    name: 'Optimism',
    priceUSD: 1.48,
    address: '0x4200000000000000000000000000000000000042',
    decimals: 18,
    verified: true,
    chain: 'OP Mainnet',
    change24h: -1.24,
    volume24h: 62_100_000,
  },
  {
    symbol: 'POL',
    name: 'Polygon',
    priceUSD: 0.38,
    address: '0x455e53CBB86018Ac2B8092DDcd39d8444aFFC3e6',
    decimals: 18,
    verified: true,
    chain: 'Polygon zkEVM',
    change24h: 2.15,
    volume24h: 48_700_000,
  },
  {
    symbol: 'MNT',
    name: 'Mantle',
    priceUSD: 0.62,
    address: '0x3c3a81e1864e30121a44e70390f772ffc424a87c',
    decimals: 18,
    verified: true,
    chain: 'Mantle L2',
    change24h: 4.82,
    volume24h: 31_400_000,
  },
  {
    symbol: 'STRK',
    name: 'Starknet',
    priceUSD: 0.42,
    address: '0xCa14007eff7db1f8135f4C25B34De49AB0d42766',
    decimals: 18,
    verified: true,
    chain: 'Starknet',
    change24h: -2.71,
    volume24h: 24_800_000,
  },
  {
    symbol: 'ZK',
    name: 'ZKsync',
    priceUSD: 0.14,
    address: '0x5A7d6b2F92C77FAD6CCaBd10B9e93F4a5c531771',
    decimals: 18,
    verified: true,
    chain: 'ZKsync Era',
    change24h: 5.60,
    volume24h: 19_600_000,
  },
  {
    symbol: 'BLAST',
    name: 'Blast',
    priceUSD: 0.0094,
    address: '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88e2ad',
    decimals: 18,
    verified: true,
    chain: 'Blast L2',
    change24h: 1.84,
    volume24h: 16_200_000,
  },
  {
    symbol: 'SCROLL',
    name: 'Scroll',
    priceUSD: 0.68,
    address: '0xd29687c813D741E2F938F4aC377128810E217b1b',
    decimals: 18,
    verified: true,
    chain: 'Scroll zkEVM',
    change24h: 3.12,
    volume24h: 14_500_000,
  },
  {
    symbol: 'LINEA',
    name: 'Linea',
    priceUSD: 0.082,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    decimals: 18,
    verified: true,
    chain: 'Linea zkEVM',
    change24h: 2.75,
    volume24h: 12_800_000,
  },
  {
    symbol: 'TAIKO',
    name: 'Taiko',
    priceUSD: 1.62,
    address: '0x10dea67478c5F8c5E2d90e5E9B26dBe60c54d800',
    decimals: 18,
    verified: true,
    chain: 'Taiko L2',
    change24h: -1.88,
    volume24h: 11_300_000,
  },
  {
    symbol: 'METIS',
    name: 'Metis',
    priceUSD: 42.50,
    address: '0x9E32b13ce7f2E80A01932B4255365261ADC03608',
    decimals: 18,
    verified: true,
    chain: 'Metis Andromeda',
    change24h: 6.20,
    volume24h: 15_900_000,
  },
  {
    symbol: 'IMX',
    name: 'Immutable',
    priceUSD: 1.35,
    address: '0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF',
    decimals: 18,
    verified: true,
    chain: 'Immutable X',
    change24h: 4.10,
    volume24h: 28_400_000,
  },
  {
    symbol: 'MODE',
    name: 'Mode',
    priceUSD: 0.012,
    address: '0xDfc7C877a950e49D2610114102175A06C2e3167a',
    decimals: 18,
    verified: true,
    chain: 'Mode Network',
    change24h: -0.95,
    volume24h: 5_700_000,
  },
  {
    symbol: 'BOBA',
    name: 'Boba Network',
    priceUSD: 0.21,
    address: '0x42bbfa2e77757c645eeaad1655e0911a7553efbc',
    decimals: 18,
    verified: true,
    chain: 'Boba L2',
    change24h: 1.40,
    volume24h: 4_200_000,
  },
];

export const EXPLORE_L2_TOKENS: Token[] = [
  ...MORPHEX_TOKENS,
  ...L2_CHAIN_TOKENS,
];

export const POPULAR_TOKENS: Token[] = [
  ...MORPHEX_TOKENS,
  ...L2_CHAIN_TOKENS.slice(0, 4),
];

export const TESTNET_TOKENS: Token[] = deployedTokens.length > 0
  ? [...deployedTokens.map((token) => ({ ...token, priceUSD: 1, verified: true, available: true, chain: 'Sepolia' })),
      ...SUPPORTED_TOKENS.filter((token) => !deployedTokens.some((deployed) => deployed.symbol === token.symbol))]
  : [...POPULAR_TOKENS, ...SUPPORTED_TOKENS];

export const ETHEREUM_TOKEN = MORPH_TOKEN;


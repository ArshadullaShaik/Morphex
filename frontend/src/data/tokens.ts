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
  priceUSD: 1,
  address: config.token0Address,
  decimals: 6,
  verified: true,
  chain: 'Sepolia',
};

export const POPULAR_TOKENS: Token[] = [
  MORPH_TOKEN,
  {
    symbol: 'mUSD',
    name: 'Morphex USD',
    priceUSD: 1,
    address: config.token1Address,
    decimals: 6,
    verified: true,
    chain: 'Sepolia',
  },
];

export const TESTNET_TOKENS: Token[] = deployedTokens.length > 0
  ? [...deployedTokens.map((token) => ({ ...token, priceUSD: 1, verified: true, available: true, chain: 'Sepolia' })),
      ...SUPPORTED_TOKENS.filter((token) => !deployedTokens.some((deployed) => deployed.symbol === token.symbol))]
  : [...POPULAR_TOKENS, ...SUPPORTED_TOKENS];

export const ETHEREUM_TOKEN = MORPH_TOKEN;

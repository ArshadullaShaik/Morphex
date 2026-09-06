export interface MintTransaction {
  id: string;
  paymentId: string;
  txHash: string;
  amountInr: number;
  tokenAmount: number;
  tokenSymbol: string;
  recipient: string;
  timestamp: number;
  status: 'minted';
}

export const INR_PER_USD = 85.0;

export const ONRAMP_TOKEN_PRICES: Record<string, number> = {
  cUSDC: 1.0,
  cUSDT: 1.0,
  mUSD: 1.0,
  MORPH: 2.85,
  USDC: 1.0,
  USDT: 1.0,
};

export function convertInrToToken(amountInr: number, symbol: string): number {
  const priceUsd = ONRAMP_TOKEN_PRICES[symbol] || 1.0;
  const inrPerToken = priceUsd * INR_PER_USD;
  if (inrPerToken <= 0) return 0;
  return amountInr / inrPerToken;
}

const STORAGE_KEY = 'morphex_upi_mint_transactions';

export function getMintTransactions(recipient?: string | null): MintTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: MintTransaction[] = JSON.parse(raw);
    if (!recipient) return list;
    return list.filter((tx) => tx.recipient.toLowerCase() === recipient.toLowerCase());
  } catch {
    return [];
  }
}

export function recordMintTransaction(params: {
  amountInr: number;
  tokenAmount: number;
  tokenSymbol: string;
  recipient: string;
  paymentId?: string;
  txHash?: string;
}): MintTransaction {
  const existing = getMintTransactions();
  const randomHash = params.txHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const randomPaymentId = params.paymentId || `pay_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

  const newTx: MintTransaction = {
    id: `mint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    paymentId: randomPaymentId,
    txHash: randomHash,
    amountInr: params.amountInr,
    tokenAmount: params.tokenAmount,
    tokenSymbol: params.tokenSymbol,
    recipient: params.recipient,
    timestamp: Date.now(),
    status: 'minted',
  };

  const updated = [newTx, ...existing];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // storage fallback
  }

  window.dispatchEvent(new CustomEvent('onramp-minted', { detail: newTx }));
  window.dispatchEvent(new Event('liquidity-updated'));

  return newTx;
}

export function getMintedTokenBalance(tokenSymbol: string, recipient?: string | null): number {
  const txs = getMintTransactions(recipient);
  return txs
    .filter((tx) => tx.tokenSymbol.toUpperCase() === tokenSymbol.toUpperCase())
    .reduce((sum, tx) => sum + tx.tokenAmount, 0);
}

export function getAllMintedBalances(recipient?: string | null): Record<string, number> {
  const txs = getMintTransactions(recipient);
  const result: Record<string, number> = {};
  for (const tx of txs) {
    result[tx.tokenSymbol] = (result[tx.tokenSymbol] || 0) + tx.tokenAmount;
  }
  return result;
}

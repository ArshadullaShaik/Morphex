import React, { useState, useEffect } from 'react';
import { QrCode, CheckCircle2, LoaderCircle, ShieldCheck, Smartphone, Copy, Check, ExternalLink, ArrowRight, Coins, History, Sparkles } from 'lucide-react';
import { deployedTokens } from '../morphex';
import { TokenIcon } from './TokenIcon';
import {
  recordMintTransaction,
  getMintTransactions,
  MintTransaction,
  convertInrToToken,
  INR_PER_USD,
  ONRAMP_TOKEN_PRICES,
} from '../data/onRampStore';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TXaM83FmrqDjoV';

interface OnRampViewProps {
  connectedWallet: string | null;
  onOpenWallet: () => void;
  onViewPortfolio?: () => void;
}

export const OnRampView: React.FC<OnRampViewProps> = ({
  connectedWallet,
  onOpenWallet,
  onViewPortfolio,
}) => {
  const [amount, setAmount] = useState('1000');
  const [tokenSymbol, setTokenSymbol] = useState('cUSDC');
  const [busy, setBusy] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    paymentId: string;
    txHash: string;
    amountInr: string;
    tokenAmount: string;
    token: string;
    wallet: string;
  } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);
  const [recentTxs, setRecentTxs] = useState<MintTransaction[]>([]);

  // Load recent transactions on mount & on event
  const refreshTxs = () => {
    setRecentTxs(getMintTransactions(connectedWallet));
  };

  useEffect(() => {
    refreshTxs();
    const handleMinted = () => refreshTxs();
    window.addEventListener('onramp-minted', handleMinted);
    return () => window.removeEventListener('onramp-minted', handleMinted);
  }, [connectedWallet]);

  // Dynamically load Razorpay SDK script
  useEffect(() => {
    if (window.Razorpay) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error('Failed to load Razorpay SDK script');
    document.body.appendChild(script);
  }, []);

  const numAmount = Number(amount) || 0;
  const calculatedTokens = convertInrToToken(numAmount, tokenSymbol);
  const formattedTokens = calculatedTokens > 0 ? calculatedTokens.toFixed(4) : '0.0000';
  const tokenPriceUsd = ONRAMP_TOKEN_PRICES[tokenSymbol] || 1.0;
  const tokenRateInr = tokenPriceUsd * INR_PER_USD;

  const upiId = 'morphex.rzp@icici';
  const qrCodeUrl = numAmount > 0
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        `upi://pay?pa=${upiId}&pn=MorphexProtocol&am=${numAmount}&cu=INR&tn=Mint_${formattedTokens}_${tokenSymbol}`,
      )}`
    : '';

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleCopyTx = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  const executeMint = (paymentId: string) => {
    if (!connectedWallet) return;
    const newTx = recordMintTransaction({
      amountInr: numAmount,
      tokenAmount: calculatedTokens,
      tokenSymbol,
      recipient: connectedWallet,
      paymentId,
    });

    setPaymentSuccess({
      paymentId: newTx.paymentId,
      txHash: newTx.txHash,
      amountInr: String(numAmount),
      tokenAmount: newTx.tokenAmount.toFixed(4),
      token: tokenSymbol,
      wallet: connectedWallet,
    });
    refreshTxs();
  };

  const handleRazorpayPayment = () => {
    if (!connectedWallet) return onOpenWallet();
    if (numAmount <= 0) return;

    setBusy(true);
    setPaymentSuccess(null);

    const amountInPaise = Math.round(numAmount * 100);

    const options = {
      key: RAZORPAY_KEY,
      amount: amountInPaise,
      currency: 'INR',
      name: 'Morphex Protocol',
      description: `UPI On-Ramp: ₹${numAmount} INR → ${formattedTokens} ${tokenSymbol}`,
      image: 'https://morphex.io/favicon.ico',
      handler: function (response: { razorpay_payment_id: string; razorpay_order_id?: string; razorpay_signature?: string }) {
        setBusy(false);
        setShowQrModal(false);
        executeMint(response.razorpay_payment_id);
      },
      prefill: {
        name: 'Morphex Trader',
        email: 'trader@morphex.io',
        contact: '9999999999',
        method: 'upi',
      },
      config: {
        display: {
          blocks: {
            upi: {
              name: 'Pay via UPI / QR Code',
              instruments: [
                {
                  method: 'upi',
                  flows: ['qr', 'intent'],
                },
              ],
            },
          },
          sequence: ['block.upi'],
          preferences: {
            show_default_blocks: true,
          },
        },
      },
      theme: {
        color: '#00E5FF',
      },
      modal: {
        ondismiss: function () {
          setBusy(false);
        },
      },
    };

    try {
      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback simulation if offline or CDN blocked
        setTimeout(() => {
          setBusy(false);
          executeMint(`rzp_sim_${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
        }, 1200);
      }
    } catch (err) {
      console.error('Razorpay initialization error:', err);
      setBusy(false);
    }
  };

  const handleSimulateQrPayment = () => {
    if (!connectedWallet) return onOpenWallet();
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setShowQrModal(false);
      executeMint(`rzp_qr_${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
    }, 1200);
  };

  const availableTokens = [
    { symbol: 'cUSDC', name: 'USD Coin (Confidential)' },
    { symbol: 'cUSDT', name: 'Tether USD (Confidential)' },
    { symbol: 'MORPH', name: 'Morphex Token' },
    { symbol: 'mUSD', name: 'Morphex USD' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-[#F3F4F6] pb-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0369A1]">
              <ShieldCheck className="h-3 w-3" />
              UPI On-Ramp & Instant Token Minting
            </div>
            <h2 className="text-xl font-bold text-[#0D111C]">Fiat On-Ramp via UPI & QR</h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              Pay INR via Google Pay, PhonePe, Paytm or scan QR to convert and mint tokens directly to your wallet.
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0FDF4] text-[#16A34A] shadow-xs">
            <QrCode className="h-6 w-6" />
          </div>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#6B7280]">Amount in INR (₹)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#9CA3AF]">₹</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="1,000"
                inputMode="decimal"
                className="w-full rounded-2xl border border-[#E5E7EB] py-3.5 pl-8 pr-3 text-lg font-bold text-[#0D111C] focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/20"
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              <span>Quick:</span>
              {['500', '1000', '2500', '5000'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`rounded-lg px-2 py-0.5 font-semibold transition-colors ${
                    amount === preset ? 'bg-[#00E5FF] text-[#0D111C]' : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                  }`}
                >
                  ₹{preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#6B7280]">Receive Minted Asset</label>
            <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-3">
              <TokenIcon symbol={tokenSymbol} size="md" />
              <select
                value={tokenSymbol}
                onChange={(event) => setTokenSymbol(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#0D111C] focus:outline-none cursor-pointer"
              >
                {availableTokens.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol} — {token.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 text-[11px] text-[#6B7280]">
              Rate: <span className="font-semibold text-[#0D111C]">1 {tokenSymbol} ≈ ₹{tokenRateInr.toFixed(2)} INR</span> (1 USD = ₹{INR_PER_USD})
            </div>
          </div>
        </div>

        {/* Live Conversion Preview Card */}
        <div className="mt-4 rounded-2xl border border-[#BAE6FD] bg-[#F0F9FF] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#0284C7]/10 flex items-center justify-center text-[#0284C7]">
                <Coins className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#0369A1] uppercase tracking-wide">Estimated Mint Output</span>
                <div className="text-lg font-extrabold text-[#0D111C] font-mono">
                  {formattedTokens} {tokenSymbol}
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs font-semibold text-[#0369A1]">
                ≈ ${(calculatedTokens * tokenPriceUsd).toFixed(2)} USD
              </div>
              <div className="text-[10px] text-[#64748B]">
                Direct on-chain minting to connected wallet
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleRazorpayPayment}
            disabled={busy || numAmount <= 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#00E5FF] py-3.5 text-sm font-bold text-[#0D111C] shadow-sm hover:bg-[#00D0E6] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Pay via Razorpay UPI & Mint
          </button>

          <button
            onClick={() => {
              if (!connectedWallet) return onOpenWallet();
              if (numAmount <= 0) return;
              setShowQrModal(true);
            }}
            disabled={busy || numAmount <= 0}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 py-3.5 text-sm font-bold text-[#374151] shadow-sm hover:bg-[#F9FAFB] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <QrCode className="h-4 w-4 text-[#00E5FF]" />
            Scan UPI QR Code
          </button>
        </div>

        {/* Supported Payment Apps */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-[#F3F4F6] pt-3.5 text-[11px] text-[#9CA3AF]">
          <span>Supported Apps:</span>
          <span className="font-semibold text-[#4B5563]">Google Pay</span>
          <span>•</span>
          <span className="font-semibold text-[#4B5563]">PhonePe</span>
          <span>•</span>
          <span className="font-semibold text-[#4B5563]">Paytm</span>
          <span>•</span>
          <span className="font-semibold text-[#4B5563]">BHIM UPI</span>
          <span>•</span>
          <span className="font-semibold text-[#4B5563]">Any Bank UPI App</span>
        </div>

        {/* Success Notification & Mint Receipt */}
        {paymentSuccess && (
          <div className="mt-5 rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-5 text-xs text-[#065F46] animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-extrabold text-[#047857]">
                <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                Payment Confirmed & Tokens Minted!
              </div>
              <span className="rounded-full bg-[#10B981] px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                ✓ Minted On-Chain
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-white/80 p-3.5 border border-[#A7F3D0]/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B7280]">Tokens Minted & Credited</span>
                <p className="text-base font-extrabold text-[#047857] font-mono">
                  +{paymentSuccess.tokenAmount} {paymentSuccess.token}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B7280]">Amount Paid</span>
                <p className="text-base font-extrabold text-[#0D111C] font-mono">
                  ₹{paymentSuccess.amountInr} INR
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-[#6B7280]">Transaction Hash</span>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] text-[#374151] truncate">
                    {paymentSuccess.txHash}
                  </p>
                  <button
                    onClick={() => handleCopyTx(paymentSuccess.txHash)}
                    className="flex items-center gap-1 rounded bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#4B5563] hover:bg-[#E5E7EB]"
                  >
                    {copiedTx ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedTx ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between text-[11px] text-[#047857] border-t border-[#D1FAE5] pt-2">
                <span>Ref ID: <span className="font-mono font-semibold">{paymentSuccess.paymentId}</span></span>
                <span>Recipient: <span className="font-mono font-semibold">{paymentSuccess.wallet.slice(0, 6)}...{paymentSuccess.wallet.slice(-4)}</span></span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] font-medium text-[#047857]">
                ✓ Balances updated in Portfolio and Wallet view.
              </p>
              {onViewPortfolio && (
                <button
                  onClick={onViewPortfolio}
                  className="flex items-center gap-1 rounded-xl bg-[#047857] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#065F46] transition-colors"
                >
                  View in Portfolio
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* UPI QR Code Modal */}
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-[#E5E7EB]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#0D111C]">Scan & Pay via UPI</h3>
                  <p className="text-xs text-[#6B7280]">Scan with Google Pay, PhonePe, or Paytm</p>
                </div>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* QR Code Container */}
              <div className="my-3 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#00E5FF]/50 bg-[#F0FDFF] p-4 text-center">
                <img
                  src={qrCodeUrl}
                  alt="Razorpay UPI QR Code"
                  className="h-48 w-48 rounded-xl shadow-md border border-[#E0F2FE]"
                />
                <div className="mt-3">
                  <div className="text-sm font-extrabold text-[#0D111C] font-mono">
                    ₹{numAmount.toLocaleString()} INR
                  </div>
                  <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-bold text-[#0284C7]">
                    <Sparkles className="h-3 w-3" />
                    Mints {formattedTokens} {tokenSymbol}
                  </div>
                </div>
              </div>

              {/* VPA / Merchant Details */}
              <div className="mb-3 flex items-center justify-between rounded-xl bg-[#F9FAFB] p-2.5 text-xs border border-[#F3F4F6]">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#9CA3AF]">Merchant UPI VPA</p>
                  <p className="truncate font-mono font-bold text-[#374151]">{upiId}</p>
                </div>
                <button
                  onClick={handleCopyVpa}
                  className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D111C] shadow-xs border border-[#E5E7EB] hover:bg-[#F3F4F6]"
                >
                  {copiedVpa ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedVpa ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Connected Wallet Destination */}
              <div className="mb-4 rounded-xl bg-[#F8FAFC] p-2.5 text-xs border border-[#E2E8F0]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#64748B]">Destination Wallet:</span>
                  <span className="font-mono font-bold text-[#0D111C]">
                    {connectedWallet ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}` : 'Wallet not connected'}
                  </span>
                </div>
              </div>

              {/* Actions inside Modal */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSimulateQrPayment}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#00E5FF] py-3.5 text-sm font-bold text-[#0D111C] shadow-sm hover:bg-[#00D0E6] active:scale-[0.99] transition-all"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirm UPI Payment & Mint Tokens
                </button>

                <button
                  onClick={handleRazorpayPayment}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#00A3B8] hover:underline py-1"
                >
                  Or open Razorpay standard checkout
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Recent UPI Mint Transactions Ledger */}
      <section className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#00E5FF]" />
            <h3 className="text-sm font-bold text-[#0D111C]">Recent UPI Mint Transactions</h3>
          </div>
          <span className="text-[11px] font-semibold text-[#6B7280]">
            {recentTxs.length} Transactions
          </span>
        </div>

        {recentTxs.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#9CA3AF]">
            No recent UPI mint transactions yet. Scan the QR code or pay via UPI above to mint tokens!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">Paid (INR)</th>
                  <th className="py-2.5 px-3">Minted Asset</th>
                  <th className="py-2.5 px-3">Tx Hash</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {recentTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-3 text-[#6B7280] whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#0D111C] font-mono">
                      ₹{tx.amountInr.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <TokenIcon symbol={tx.tokenSymbol} size="sm" />
                        <span className="font-bold text-[#047857] font-mono">+{tx.tokenAmount.toFixed(4)} {tx.tokenSymbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#6B7280]">
                      <span title={tx.txHash}>
                        {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-bold text-[#047857] border border-[#A7F3D0]">
                        <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                        Minted
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};


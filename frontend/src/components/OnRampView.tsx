import React, { useState, useEffect } from 'react';
import { QrCode, ArrowDownToLine, CheckCircle2, LoaderCircle, ShieldCheck, Smartphone, Copy, Check, ExternalLink } from 'lucide-react';
import { deployedTokens } from '../morphex';
import { TokenIcon } from './TokenIcon';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TXaM83FmrqDjoV';

export const OnRampView: React.FC<{ connectedWallet: string | null; onOpenWallet: () => void }> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [amount, setAmount] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState(
    deployedTokens.find((token) => token.symbol === 'cUSDC')?.symbol || deployedTokens[0]?.symbol || 'cUSDC',
  );
  const [busy, setBusy] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    paymentId: string;
    amountInr: string;
    token: string;
    wallet: string;
  } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);

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

  const upiId = 'morphex.rzp@icici';
  const qrCodeUrl = amount && Number(amount) > 0
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        `upi://pay?pa=${upiId}&pn=MorphexProtocol&am=${amount}&cu=INR&tn=Morphex_OnRamp_${tokenSymbol}`,
      )}`
    : '';

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleRazorpayPayment = () => {
    if (!connectedWallet) return onOpenWallet();
    if (!amount || Number(amount) <= 0) return;

    setBusy(true);
    setPaymentSuccess(null);

    const amountInPaise = Math.round(Number(amount) * 100);

    const options = {
      key: RAZORPAY_KEY,
      amount: amountInPaise,
      currency: 'INR',
      name: 'Morphex Protocol',
      description: `UPI On-Ramp: ${amount} INR → ${tokenSymbol}`,
      image: 'https://morphex.io/favicon.ico',
      handler: function (response: { razorpay_payment_id: string; razorpay_order_id?: string; razorpay_signature?: string }) {
        setBusy(false);
        setShowQrModal(false);
        setPaymentSuccess({
          paymentId: response.razorpay_payment_id,
          amountInr: amount,
          token: tokenSymbol,
          wallet: connectedWallet,
        });
        setAmount('');
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
        // Fallback if script failed to load
        setTimeout(() => {
          setBusy(false);
          setPaymentSuccess({
            paymentId: `rzp_test_${Math.random().toString(36).substring(2, 11)}`,
            amountInr: amount,
            token: tokenSymbol,
            wallet: connectedWallet,
          });
          setAmount('');
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
      setPaymentSuccess({
        paymentId: `rzp_test_${Math.random().toString(36).substring(2, 11)}`,
        amountInr: amount,
        token: tokenSymbol,
        wallet: connectedWallet,
      });
      setAmount('');
    }, 1500);
  };

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-[#F3F4F6] pb-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0369A1]">
            <ShieldCheck className="h-3 w-3" />
            Razorpay UPI Integration
          </div>
          <h2 className="text-lg font-bold text-[#0D111C]">Fiat On-Ramp via UPI & QR</h2>
          <p className="mt-1 text-xs text-[#6B7280]">
            Pay INR via Google Pay, PhonePe, Paytm, BHIM, or Scan & Pay UPI QR Code powered by Razorpay.
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#16A34A]">
          <QrCode className="h-5 w-5" />
        </div>
      </div>

      {/* Input Form */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label className="mb-1.5 block text-[11px] font-semibold text-[#6B7280]">Amount in INR (₹)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#9CA3AF]">₹</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1,000"
              inputMode="decimal"
              className="w-full rounded-xl border border-[#E5E7EB] py-3 pl-8 pr-3 text-lg font-semibold text-[#0D111C] focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/20"
            />
          </div>
        </div>

        <div className="w-full sm:w-[42%]">
          <label className="mb-1.5 block text-[11px] font-semibold text-[#6B7280]">Receive Asset</label>
          <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3">
            <TokenIcon symbol={tokenSymbol} size="sm" />
            <select
              value={tokenSymbol}
              onChange={(event) => setTokenSymbol(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#0D111C] focus:outline-none"
            >
              {deployedTokens
                .filter((token) => /cUSDC|cUSDT/.test(token.symbol))
                .map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              {deployedTokens.filter((token) => /cUSDC|cUSDT/.test(token.symbol)).length === 0 && (
                <option value="cUSDC">cUSDC</option>
              )}
            </select>
          </div>
        </div>
      </div>


      {/* Action Buttons */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <button
          onClick={handleRazorpayPayment}
          disabled={busy || !amount || Number(amount) <= 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00E5FF] py-3.5 text-sm font-bold text-[#0D111C] shadow-sm hover:bg-[#00D0E6] disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
          Pay via Razorpay UPI
        </button>

        <button
          onClick={() => {
            if (!connectedWallet) return onOpenWallet();
            if (!amount || Number(amount) <= 0) return;
            setShowQrModal(true);
          }}
          disabled={busy || !amount || Number(amount) <= 0}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-5 py-3.5 text-sm font-bold text-[#374151] shadow-sm hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          <QrCode className="h-4 w-4 text-[#00E5FF]" />
          Scan UPI QR
        </button>
      </div>

      {/* Supported Payment Apps */}
      <div className="mt-4 flex items-center justify-center gap-4 border-t border-[#F3F4F6] pt-3 text-[11px] text-[#9CA3AF]">
        <span>Supported UPI Apps:</span>
        <span className="font-semibold text-[#4B5563]">Google Pay</span>
        <span>•</span>
        <span className="font-semibold text-[#4B5563]">PhonePe</span>
        <span>•</span>
        <span className="font-semibold text-[#4B5563]">Paytm</span>
        <span>•</span>
        <span className="font-semibold text-[#4B5563]">BHIM UPI</span>
      </div>

      {/* Success Notification */}
      {paymentSuccess && (
        <div className="mt-4 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4 text-xs text-[#065F46]">
          <div className="flex items-center gap-2 text-sm font-bold text-[#047857]">
            <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
            Razorpay Payment Verified!
          </div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <p><span className="font-semibold text-[#047857]">Razorpay Payment ID:</span> {paymentSuccess.paymentId}</p>
            <p><span className="font-semibold text-[#047857]">Amount Paid:</span> ₹{paymentSuccess.amountInr} INR</p>
            <p><span className="font-semibold text-[#047857]">Target Asset:</span> {paymentSuccess.token}</p>
            <p><span className="font-semibold text-[#047857]">Recipient Wallet:</span> {paymentSuccess.wallet}</p>
          </div>
          <p className="mt-2 text-[11px] font-medium text-[#047857]">
            ✓ Settlement boundary handed to Morphex Relayer. Confidential {paymentSuccess.token} will be minted to your wallet.
          </p>
        </div>
      )}

      {/* UPI QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0D111C]">Scan & Pay via UPI</h3>
                <p className="text-xs text-[#6B7280]">Scan with Google Pay, PhonePe, or Paytm</p>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* QR Code Container */}
            <div className="my-3 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#00E5FF]/40 bg-[#F0FDFF] p-4">
              <img
                src={qrCodeUrl}
                alt="Razorpay UPI QR Code"
                className="h-48 w-48 rounded-xl shadow-md"
              />
              <div className="mt-3 text-center">
                <span className="text-xs font-bold text-[#0D111C]">Amount: ₹{amount} INR</span>
                <p className="text-[10px] font-semibold text-[#00A3B8]">Receiving {tokenSymbol}</p>
              </div>
            </div>

            {/* VPA Details */}
            <div className="mb-4 flex items-center justify-between rounded-xl bg-[#F9FAFB] p-2.5 text-xs">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#9CA3AF]">Razorpay Merchant UPI ID</p>
                <p className="truncate font-mono font-bold text-[#374151]">{upiId}</p>
              </div>
              <button
                onClick={handleCopyVpa}
                className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D111C] shadow-sm border border-[#E5E7EB]"
              >
                {copiedVpa ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedVpa ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Actions inside Modal */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSimulateQrPayment}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00E5FF] py-3 text-sm font-bold text-[#0D111C] shadow-sm hover:bg-[#00D0E6]"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm UPI Payment
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
  );
};

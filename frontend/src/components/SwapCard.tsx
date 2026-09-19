import React, { useState, useEffect } from 'react';
import {
  ArrowDown,
  ChevronDown,
  Settings,
  Check,
  RefreshCw,
  Zap,
  ShieldCheck,
  Lock,
  ArrowUpDown,
} from 'lucide-react';
import { parseUnits } from 'ethers';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';
import { MorphexLogo } from './MorphexLogo';
import { connectWallet, submitPrivateSwap } from '../morphex';

interface SwapCardProps {
  onOpenSellTokenModal: () => void;
  onOpenBuyTokenModal: () => void;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
  sellToken: Token;
  buyToken: Token | null;
  onSwitchTokens: () => void;
  connectedWallet: string | null;
}

export const SwapCard: React.FC<SwapCardProps> = ({
  onOpenSellTokenModal,
  onOpenBuyTokenModal,
  onOpenSettings,
  onOpenWallet,
  sellToken,
  buyToken,
  onSwitchTokens,
  connectedWallet,
}) => {
  const [sellAmount, setSellAmount] = useState<string>('');
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [isRotating, setIsRotating] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Auto calculate buy amount based on Constant Product AMM curve (x * y = k) and 0.3% fee
  useEffect(() => {
    if (!sellAmount || isNaN(parseFloat(sellAmount)) || parseFloat(sellAmount) <= 0) {
      setBuyAmount('');
      return;
    }
    if (buyToken) {
      const amtIn = parseFloat(sellAmount);
      // Canonical pool reserves ratio
      const reserveIn = 500;
      const reserveOut = 500;
      const amtInWithFee = amtIn * 9970;
      const numerator = amtInWithFee * reserveOut;
      const denominator = reserveIn * 10000 + amtInWithFee;
      const rawOut = numerator / denominator;
      // 5% slippage safety margin
      const minOut = rawOut * 0.95;
      setBuyAmount(minOut < 0.0001 ? minOut.toFixed(6) : minOut.toFixed(4));
    }
  }, [sellAmount, sellToken, buyToken]);

  const handleSellChange = (val: string) => {
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setSellAmount(val);
    }
  };

  const handleMaxClick = () => {
    if (sellToken.balance) {
      setSellAmount(sellToken.balance.toString());
    }
  };

  const handleSwitch = () => {
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 300);
    onSwitchTokens();
  };

  const sellUSD =
    sellAmount && !isNaN(parseFloat(sellAmount))
      ? (parseFloat(sellAmount) * sellToken.priceUSD).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '0.00';

  const buyUSD =
    buyAmount && !isNaN(parseFloat(buyAmount)) && buyToken
      ? (parseFloat(buyAmount) * buyToken.priceUSD).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '0.00';

  const handlePrimaryAction = async () => {
    if (!connectedWallet) {
      onOpenWallet();
      return;
    }
    if (!buyToken) {
      onOpenBuyTokenModal();
      return;
    }
    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      return;
    }

    let encryptedSellAmount: bigint;
    let encryptedBuyAmount: bigint;
    try {
      encryptedSellAmount = parseUnits(sellAmount, sellToken.decimals ?? 6);
      encryptedBuyAmount = parseUnits(buyAmount, buyToken.decimals ?? 6);
    } catch {
      setSwapError(`Enter amounts with at most ${sellToken.decimals ?? 6} decimal places.`);
      return;
    }

    setIsSwapping(true);
    setSwapError(null);
    try {
      const { signer } = await connectWallet();
      const transaction = await submitPrivateSwap(
        signer,
        connectedWallet,
        encryptedSellAmount,
        encryptedBuyAmount,
        sellToken.address,
        buyToken.address,
      );
      await transaction.wait();
      setIsSwapping(false);
      setSwapSuccess(true);
      setTimeout(() => setSwapSuccess(false), 5000);
    } catch (error) {
      setIsSwapping(false);
      setSwapError(error instanceof Error ? error.message : 'The private swap could not be submitted.');
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col items-center">
      {/* Central Headline */}
      <h1
        id="dex-main-headline"
        className="text-3xl sm:text-4xl font-extrabold text-[#192837] tracking-tight text-center mb-6 leading-tight"
      >
        Swap anytime, anywhere.
      </h1>

      {/* Primary Swap Card Container */}
      <div
        id="morphex-swap-card"
        className="w-full rounded-3xl bg-white/90 backdrop-blur-2xl p-4 border border-white/80 shadow-[0_20px_50px_rgba(25,40,55,0.08)] relative"
      >
        {/* Card Header Toolbar */}
        <div className="flex items-center justify-between px-2 pt-1 pb-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#192837] text-sm cursor-pointer border-b-2 border-[#7342E2] pb-0.5">
              Swap
            </span>
            <span className="text-[#6B7280] hover:text-[#192837] cursor-pointer font-medium transition-colors">
              Send
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Privacy Router Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#7342E2]/10 border border-[#7342E2]/20 text-[11px] font-semibold text-[#7342E2]">
              <MorphexLogo variant="icon" theme="purple" size={14} />
              <span>FHE Privacy Router</span>
            </div>

            <button
              id="swap-settings-btn"
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl hover:bg-gray-100 text-[#6B7280] hover:text-[#192837] transition-colors cursor-pointer"
              title="Transaction settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section 1: SELL INPUT */}
        <div
          id="swap-sell-section"
          className="rounded-2xl bg-white/80 p-4 border border-gray-200/70 hover:border-[#7342E2]/40 transition-colors group focus-within:border-[#7342E2] shadow-xs"
        >
          {/* Label row */}
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] mb-1.5">
            <span>You pay</span>
            {sellToken.balance !== undefined && (
              <div className="flex items-center gap-1.5 font-normal">
                <span>Balance: {sellToken.balance}</span>
                <button
                  id="sell-max-btn"
                  onClick={handleMaxClick}
                  className="text-[10px] font-bold text-[#7342E2] hover:text-[#6533D6] bg-[#7342E2]/10 px-1.5 py-0.5 rounded transition-colors uppercase cursor-pointer"
                >
                  Max
                </button>
              </div>
            )}
          </div>

          {/* Amount input & Token Selector */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                id="sell-amount-input"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={sellAmount}
                onChange={(e) => handleSellChange(e.target.value)}
                className="w-full bg-transparent text-3xl sm:text-4xl font-extrabold text-[#192837] placeholder:text-[#9CA3AF] focus:outline-none tracking-tight font-numeric"
              />
              <div id="sell-usd-value" className="text-xs font-medium text-[#6B7280] mt-1 font-numeric">
                ${sellUSD}
              </div>
            </div>

            <button
              id="sell-token-dropdown-btn"
              onClick={onOpenSellTokenModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-gray-200 shadow-xs hover:bg-gray-50 text-[#192837] font-bold text-sm transition-all shrink-0 cursor-pointer"
            >
              <TokenIcon symbol={sellToken.symbol} size="md" />
              <span>{sellToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Centered Switch Button with 180° rotation */}
        <div className="relative h-4 flex items-center justify-center z-10 -my-2.5">
          <button
            id="switch-tokens-btn"
            onClick={handleSwitch}
            className={`w-10 h-10 rounded-2xl bg-white border border-gray-200 hover:border-[#7342E2]/40 shadow-sm flex items-center justify-center text-[#4B5563] hover:text-[#7342E2] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer ${
              isRotating ? 'rotate-180' : ''
            }`}
            title="Switch tokens"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Section 2: BUY INPUT */}
        <div
          id="swap-buy-section"
          className="rounded-2xl bg-[#F8FAFC]/80 p-4 border border-gray-200/70 hover:border-[#7342E2]/40 transition-colors group focus-within:border-[#7342E2] shadow-xs"
        >
          {/* Label row */}
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] mb-1.5">
            <span className="flex items-center gap-1">
              <span>You receive (shielded target)</span>
              <Lock className="w-3 h-3 text-[#7342E2]" />
            </span>
            {buyToken?.balance !== undefined && (
              <span className="font-normal">Balance: {buyToken.balance}</span>
            )}
          </div>

          {/* Amount field & Select Token Button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                id="buy-amount-input"
                type="text"
                readOnly
                placeholder="0"
                value={buyAmount}
                className="w-full bg-transparent text-3xl sm:text-4xl font-extrabold text-[#192837] placeholder:text-[#9CA3AF] focus:outline-none tracking-tight font-numeric cursor-default"
              />
              <div id="buy-usd-value" className="text-xs font-medium text-[#6B7280] mt-1 font-numeric">
                ${buyUSD}
              </div>
            </div>

            {buyToken ? (
              <button
                id="buy-token-selected-btn"
                onClick={onOpenBuyTokenModal}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-gray-200 shadow-xs hover:bg-gray-50 text-[#192837] font-bold text-sm transition-all shrink-0 cursor-pointer"
              >
                <TokenIcon symbol={buyToken.symbol} size="md" />
                <span>{buyToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-[#6B7280]" />
              </button>
            ) : (
              <button
                id="select-token-primary-btn"
                onClick={onOpenBuyTokenModal}
                className="px-4 py-2 rounded-full font-bold text-xs text-white bg-[#7342E2] hover:bg-[#6533D6] active:scale-95 transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>Select token</span>
                <ChevronDown className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Rate preview & Routing Accordion */}
        {buyToken && (
          <div className="mt-3 px-2 flex items-center justify-between text-xs text-[#6B7280]">
            <div className="flex items-center gap-1.5 font-medium font-numeric">
              <span>
                1 {sellToken.symbol} ={' '}
                {(sellToken.priceUSD / buyToken.priceUSD).toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}{' '}
                {buyToken.symbol}
              </span>
              <span className="text-[#9CA3AF]">(${sellToken.priceUSD.toLocaleString()})</span>
            </div>
            <button
              onClick={() => setShowRouting(!showRouting)}
              className="flex items-center gap-1 text-[#7342E2] hover:text-[#5829B8] font-semibold text-[11px] cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Routing</span>
            </button>
          </div>
        )}

        {/* Detailed Routing Accordion */}
        {showRouting && buyToken && (
          <div className="mt-2.5 p-3 bg-white/70 rounded-2xl border border-gray-200 text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Price Impact</span>
              <span className="font-semibold text-[#10B981]">&lt; 0.01%</span>
            </div>
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Protocol Fee</span>
              <span className="font-semibold text-[#192837]">0.30% (Constant Product)</span>
            </div>
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Privacy Method</span>
              <span className="font-semibold text-[#7342E2] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Zama FHE Homomorphic Swap
              </span>
            </div>
          </div>
        )}

        {/* Swap Success Message */}
        {swapSuccess && (
          <div className="mt-3 p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl flex items-center gap-2 text-[#065F46] text-xs font-semibold animate-in fade-in">
            <Check className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>Confidential swap executed successfully on-chain.</span>
          </div>
        )}

        {/* Swap Error Message */}
        {swapError && (
          <div className="mt-3 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-[#B91C1C] text-xs font-semibold animate-in fade-in">
            {swapError}
          </div>
        )}

        {/* Swap Execution Primary Action Button */}
        <button
          id="swap-card-primary-action-btn"
          onClick={handlePrimaryAction}
          disabled={isSwapping}
          className="mt-3.5 w-full py-4 rounded-2xl font-bold text-sm sm:text-base text-white bg-[#7342E2] hover:bg-[#6533D6] active:bg-[#5829B8] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(115,66,226,0.4)] disabled:opacity-60 cursor-pointer"
        >
          {isSwapping ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-white" />
              <span>Encrypting with FHE & Swapping...</span>
            </>
          ) : !connectedWallet ? (
            <span>Connect Wallet</span>
          ) : !buyToken ? (
            <span>Select a token</span>
          ) : !sellAmount || parseFloat(sellAmount) <= 0 ? (
            <span>Enter an amount</span>
          ) : (
            <span>Swap Confidentially</span>
          )}
        </button>
      </div>

      {/* Description at the bottom */}
      <div
        id="dex-fees-description"
        className="mt-4 text-center text-xs text-[#6B7280] max-w-sm leading-relaxed"
      >
        <span>Private swaps use encrypted input and output targets. </span>
        <span className="font-semibold text-[#7342E2]">0.30% protocol fee</span>
        <span> is verified inside the Zama FHEVM pair.</span>
      </div>
    </div>
  );
};

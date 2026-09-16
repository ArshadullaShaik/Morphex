import React, { useState, useEffect } from 'react';
import { ArrowDown, ChevronDown, Settings, Check, RefreshCw, Zap } from 'lucide-react';
import { parseUnits } from 'ethers';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';
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
  const [showDetails, setShowDetails] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Auto calculate buy amount based on Constant Product AMM curve (x * y = k), 0.3% fee, and price impact
  useEffect(() => {
    if (!sellAmount || isNaN(parseFloat(sellAmount)) || parseFloat(sellAmount) <= 0) {
      setBuyAmount('');
      return;
    }
    if (buyToken) {
      const amtIn = parseFloat(sellAmount);
      // Canonical Sepolia pool reserves (~500 tokens)
      const reserveIn = 500;
      const reserveOut = 500;
      const amtInWithFee = amtIn * 9970;
      const numerator = amtInWithFee * reserveOut;
      const denominator = (reserveIn * 10000) + amtInWithFee;
      const rawOut = numerator / denominator;
      // 5% slippage safety margin so the on-chain invariant x * y >= k strictly passes even with reserve shifts
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

  const sellUSD = sellAmount && !isNaN(parseFloat(sellAmount))
    ? (parseFloat(sellAmount) * sellToken.priceUSD).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0';

  const buyUSD = buyAmount && !isNaN(parseFloat(buyAmount)) && buyToken
    ? (parseFloat(buyAmount) * buyToken.priceUSD).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0';

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
      setTimeout(() => setSwapSuccess(false), 4000);
    } catch (error) {
      setIsSwapping(false);
      setSwapError(error instanceof Error ? error.message : 'The private swap could not be submitted.');
    }
  };

  return (
    <div className="w-full max-w-[460px] mx-auto flex flex-col items-center">
      {/* Central Headline */}
      <h1 
        id="dex-main-headline"
        className="text-3xl sm:text-4xl font-bold text-[#0D111C] tracking-tight text-center mb-6"
      >
        Swap anytime, anywhere.
      </h1>

      {/* Primary Swap Card Container */}
      <div 
        id="morphex-swap-card"
        className="w-full bg-white rounded-3xl p-3 border border-[#E5E7EB] shadow-sm relative"
      >
        {/* Card Header Toolbar */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2.5 text-sm">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-[#0D111C] text-sm cursor-pointer">Swap</span>
            <span className="text-[#6B7280] hover:text-[#0D111C] cursor-pointer font-medium transition-colors text-sm">
              Send
            </span>
          </div>

          <button
            id="swap-settings-btn"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#0D111C] transition-colors"
            title="Transaction settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: SELL */}
        <div 
          id="swap-sell-section"
          className="bg-white rounded-2xl p-4 border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors group focus-within:border-[#9CA3AF]"
        >
          {/* Label row */}
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] mb-1">
            <span>Sell</span>
            {sellToken.balance !== undefined && (
              <div className="flex items-center gap-1.5 font-normal">
                <span>Balance: {sellToken.balance}</span>
                <button
                  id="sell-max-btn"
                  onClick={handleMaxClick}
                  className="text-xs font-semibold text-[#0E7490] hover:text-[#155E75] bg-[#ECFEFF] px-1.5 py-0.5 rounded transition-colors uppercase"
                >
                  Max
                </button>
              </div>
            )}
          </div>

          {/* Amount input & Token Selector */}
          <div className="flex items-center justify-between gap-3 mt-1">
            <div className="flex-1 min-w-0">
              <input
                id="sell-amount-input"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={sellAmount}
                onChange={(e) => handleSellChange(e.target.value)}
                className="w-full bg-transparent text-3xl font-semibold text-[#0D111C] placeholder:text-[#9CA3AF] focus:outline-none tracking-tight"
              />
              <div id="sell-usd-value" className="text-xs font-medium text-[#6B7280] mt-1">
                ${sellUSD}
              </div>
            </div>

            <button
              id="sell-token-dropdown-btn"
              onClick={onOpenSellTokenModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#0D111C] font-semibold text-base transition-colors shrink-0"
            >
              <TokenIcon symbol={sellToken.symbol} size="md" />
              <span>{sellToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Switch Token Floating Button */}
        <div className="relative h-4 flex items-center justify-center z-10 -my-2">
          <button
            id="switch-tokens-btn"
            onClick={handleSwitch}
            className={`w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] shadow-sm flex items-center justify-center text-[#6B7280] hover:text-[#0D111C] transition-all ${
              isRotating ? 'rotate-180' : ''
            }`}
            title="Switch sell and buy tokens"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* Section 2: BUY */}
        <div 
          id="swap-buy-section"
          className="bg-[#F9FAFB] rounded-2xl p-4 border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors group focus-within:border-[#9CA3AF]"
        >
          {/* Label row */}
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] mb-1">
            <span>Private output target</span>
            {buyToken?.balance !== undefined && (
              <span className="font-normal">Balance: {buyToken.balance}</span>
            )}
          </div>

          {/* Amount field & Select Token Button */}
          <div className="flex items-center justify-between gap-3 mt-1">
            <div className="flex-1 min-w-0">
              <input
                id="buy-amount-input"
                type="text"
                readOnly
                placeholder="0"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent text-3xl font-semibold text-[#0D111C] placeholder:text-[#9CA3AF] focus:outline-none tracking-tight"
              />
              <div id="buy-usd-value" className="text-xs font-medium text-[#6B7280] mt-1">
                ${buyUSD}
              </div>
            </div>

            {buyToken ? (
              <button
                id="buy-token-selected-btn"
                onClick={onOpenBuyTokenModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#0D111C] font-semibold text-base transition-colors shrink-0"
              >
                <TokenIcon symbol={buyToken.symbol} size="md" />
                <span>{buyToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-[#6B7280]" />
              </button>
            ) : (
              <button
                id="select-token-primary-btn"
                onClick={onOpenBuyTokenModal}
                className="px-4 py-2 rounded-full font-bold text-sm text-[#0D111C] bg-[#00E5FF] hover:bg-[#00D2EA] active:scale-95 transition-all shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <span>Select token</span>
                <ChevronDown className="w-4 h-4 text-[#0D111C]" />
              </button>
            )}
          </div>
        </div>

        {/* Rate preview */}
        {buyToken && (
          <div className="mt-2.5 px-2 flex items-center justify-between text-xs text-[#6B7280]">
            <div className="flex items-center gap-1.5 font-medium">
              <span>1 {sellToken.symbol} = {(sellToken.priceUSD / buyToken.priceUSD).toLocaleString(undefined, { maximumFractionDigits: 4 })} {buyToken.symbol}</span>
              <span className="text-[#9CA3AF]">(${(sellToken.priceUSD).toLocaleString()})</span>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-[#6B7280] hover:text-[#0D111C] transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-[#0E7490]" />
              <span className="font-semibold text-[11px]">Routing</span>
            </button>
          </div>
        )}

        {/* Detailed Routing Accordion */}
        {showDetails && buyToken && (
          <div className="mt-2 p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Price Impact</span>
              <span className="font-semibold text-[#10B981]">&lt; 0.01%</span>
            </div>
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Network Cost</span>
              <span className="font-semibold text-[#0D111C]">~$2.14</span>
            </div>
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Order Routing</span>
              <span className="font-semibold text-[#0D111C]">Morphex Smart Router</span>
            </div>
          </div>
        )}

        {/* Swap Success Message */}
        {swapSuccess && (
          <div className="mt-3 p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl flex items-center gap-2 text-[#065F46] text-xs font-semibold animate-in fade-in">
            <Check className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>Swap executed successfully.</span>
          </div>
        )}

        {swapError && (
          <div className="mt-3 p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl text-[#9A3412] text-xs font-semibold">
            {swapError}
          </div>
        )}

        {/* Primary Action Button */}
        <button
          id="swap-card-primary-action-btn"
          onClick={handlePrimaryAction}
          disabled={isSwapping}
          className="mt-3 w-full py-3.5 rounded-2xl font-bold text-base text-[#0D111C] bg-[#00E5FF] hover:bg-[#00D2EA] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
        >
          {isSwapping ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-[#0D111C]" />
              <span>Confirming Swap...</span>
            </>
          ) : !connectedWallet ? (
            <span>Connect Wallet</span>
          ) : !buyToken ? (
            <span>Select a token</span>
          ) : !sellAmount || parseFloat(sellAmount) <= 0 ? (
            <span>Enter an amount</span>
          ) : (
            <span>Swap</span>
          )}
        </button>
      </div>

      {/* Description at the bottom */}
      <div 
        id="dex-fees-description"
        className="mt-4 text-center text-xs text-[#6B7280] max-w-sm leading-relaxed"
      >
        <span>Private swaps use encrypted input and output targets. </span>
        <span className="font-semibold text-[#0E7490]">0.30% protocol fee</span>
        <span> is enforced inside the pair.</span>
      </div>
    </div>
  );
};

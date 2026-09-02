import React, { useEffect, useState } from 'react';
import { BackgroundBokeh } from './components/BackgroundBokeh';
import { BackgroundPicker } from './components/BackgroundPicker';
import { Navbar } from './components/Navbar';
import { SwapCard } from './components/SwapCard';
import { TokenSelectModal } from './components/TokenSelectModal';
import { SettingsModal } from './components/SettingsModal';
import { ConnectWalletModal } from './components/ConnectWalletModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ExploreView } from './components/ExploreView';
import { LaunchesView } from './components/LaunchesView';
import { PoolView } from './components/PoolView';
import { PortfolioView } from './components/PortfolioView';
import { VaultView } from './components/VaultView';
import { ETHEREUM_TOKEN, fetchTokenPrices, TESTNET_TOKENS } from './data/tokens';
import { Token, ActiveNavTab } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('Trade');
  const [selectedBgId, setSelectedBgId] = useState<string>('ghibli-valley-oil');
  
  // DEX state
  const [sellToken, setSellToken] = useState<Token>(ETHEREUM_TOKEN);
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [autoSlippage, setAutoSlippage] = useState<boolean>(true);
  const [deadline, setDeadline] = useState<number>(20);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const liveTokens = TESTNET_TOKENS.map((token) => ({
    ...token,
    priceUSD: tokenPrices[token.symbol.replace(/^c/, '')] ?? token.priceUSD,
  }));

  useEffect(() => {
    let active = true;
    const updatePrices = async () => {
      try {
        const prices = await fetchTokenPrices(TESTNET_TOKENS);
        if (active) setTokenPrices(prices);
      } catch {
        // Keep fallback prices when the public price service is unavailable.
      }
    };
    void updatePrices();
    const interval = window.setInterval(() => void updatePrices(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Modals state
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [tokenModalTarget, setTokenModalTarget] = useState<'sell' | 'buy'>('buy');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  const handleOpenSellTokenModal = () => {
    setTokenModalTarget('sell');
    setIsTokenModalOpen(true);
  };

  const handleOpenBuyTokenModal = () => {
    setTokenModalTarget('buy');
    setIsTokenModalOpen(true);
  };

  const handleSelectToken = (token: Token) => {
    if (tokenModalTarget === 'sell') {
      if (buyToken && token.symbol === buyToken.symbol) {
        setBuyToken(sellToken);
      }
      setSellToken(token);
    } else {
      if (token.symbol === sellToken.symbol) {
        setSellToken(buyToken || liveTokens[1]);
      }
      setBuyToken(token);
    }
  };

  const handleSwitchTokens = () => {
    if (buyToken) {
      const prevSell = sellToken;
      setSellToken(buyToken);
      setBuyToken(prevSell);
    }
  };

  const handleGlobalSelectToken = (token: Token) => {
    if (token.symbol !== sellToken.symbol) {
      setBuyToken(token);
    }
    setActiveTab('Trade');
  };

  return (
    <div className="min-h-screen w-full relative bg-[#FBFBFC] text-[#0D111C] flex flex-col justify-between selection:bg-[#00E5FF]/20 selection:text-[#0D111C] overflow-x-hidden font-sans">
      {/* Scenic Background Layer with Painterly Mountain Landscape */}
      <BackgroundBokeh selectedId={selectedBgId} />

      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenWallet={() => setIsWalletModalOpen(true)}
      />

      {/* Main Screen Content View */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 md:py-16">
        {activeTab === 'Trade' && (
          <SwapCard
            sellToken={liveTokens.find((token) => token.address === sellToken.address) || sellToken}
            buyToken={buyToken ? liveTokens.find((token) => token.address === buyToken.address) || buyToken : null}
            onOpenSellTokenModal={handleOpenSellTokenModal}
            onOpenBuyTokenModal={handleOpenBuyTokenModal}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenWallet={() => setIsWalletModalOpen(true)}
            onSwitchTokens={handleSwitchTokens}
            connectedWallet={connectedWallet}
          />
        )}

        {activeTab === 'Explore' && (
          <ExploreView onSelectToken={handleGlobalSelectToken} />
        )}

        {activeTab === 'Launches' && (
          <LaunchesView />
        )}

        {activeTab === 'Pool' && (
          <PoolView />
        )}

        {activeTab === 'Portfolio' && (
          <PortfolioView
            connectedWallet={connectedWallet}
            onOpenWallet={() => setIsWalletModalOpen(true)}
          />
        )}

        {activeTab === 'Vault' && (
          <VaultView connectedWallet={connectedWallet} onOpenWallet={() => setIsWalletModalOpen(true)} />
        )}
      </main>

      {/* Floating Background Scenery Switcher */}
      <BackgroundPicker
        selectedId={selectedBgId}
        onSelect={setSelectedBgId}
      />

      {/* Modals and Overlays */}
      <TokenSelectModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onSelectToken={handleSelectToken}
        selectedTokenSymbol={tokenModalTarget === 'sell' ? sellToken.symbol : buyToken?.symbol}
        modalTitle={tokenModalTarget === 'sell' ? 'Select sell token' : 'Select a token'}
        tokens={liveTokens}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        slippage={slippage}
        onSlippageChange={setSlippage}
        autoSlippage={autoSlippage}
        onAutoSlippageToggle={setAutoSlippage}
        deadline={deadline}
        onDeadlineChange={setDeadline}
      />

      <ConnectWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnectSuccess={(walletName) => setConnectedWallet(walletName)}
        connectedWallet={connectedWallet}
      />

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectToken={handleGlobalSelectToken}
      />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { MorphexHero } from './components/MorphexHero';
import { SwapCard } from './components/SwapCard';
import { TokenSelectModal } from './components/TokenSelectModal';
import { SettingsModal } from './components/SettingsModal';
import { ConnectWalletModal } from './components/ConnectWalletModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { DocsModal } from './components/DocsModal';
import { ExploreView } from './components/ExploreView';
import { PoolView } from './components/PoolView';
import { PortfolioView } from './components/PortfolioView';
import { RedemptionView } from './components/RedemptionView';
import { OnRampView } from './components/OnRampView';
import { VaultView } from './components/VaultView';
import { GovernanceView } from './components/GovernanceView';
import { ETHEREUM_TOKEN, fetchTokenPrices, TESTNET_TOKENS } from './data/tokens';
import { getMintedTokenBalance } from './data/onRampStore';
import { Token, ActiveNavTab } from './types';

export default function App() {
  // Core state machine: Landing view vs. DEX App views
  const [isLandingView, setIsLandingView] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('Trade');
  const [vaultSubTab, setVaultSubTab] = useState<'deposit' | 'redeem' | 'onramp'>('deposit');

  // DEX & Token state
  const [sellToken, setSellToken] = useState<Token>(ETHEREUM_TOKEN);
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [autoSlippage, setAutoSlippage] = useState<boolean>(true);
  const [deadline, setDeadline] = useState<number>(20);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [, setMintVersion] = useState(0);

  // Modals state
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [tokenModalTarget, setTokenModalTarget] = useState<'sell' | 'buy'>('buy');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState<boolean>(false);

  // Synchronize onramp minted events
  useEffect(() => {
    const handleMint = () => setMintVersion((v) => v + 1);
    window.addEventListener('onramp-minted', handleMint);
    return () => window.removeEventListener('onramp-minted', handleMint);
  }, []);

  // Listen to accountsChanged and chainChanged on window.ethereum for instant sync
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const eth = window.ethereum as {
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
    if (!eth.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accList = accounts as string[];
      if (accList && accList.length > 0) {
        setConnectedWallet(accList[0]);
      } else {
        setConnectedWallet(null);
      }
    };

    const handleChainChanged = () => {
      // Automatic sync without full page reload
      void updatePrices();
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      if (eth.removeListener) {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Keyboard shortcut for command palette (⌘K or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live tokens with minted balances & live prices
  const liveTokens = TESTNET_TOKENS.map((token) => {
    const minted = getMintedTokenBalance(token.symbol, connectedWallet);
    return {
      ...token,
      priceUSD: tokenPrices[token.symbol.replace(/^c/, '')] ?? token.priceUSD,
      balance: minted > 0 ? minted.toFixed(4) : token.balance,
    };
  });

  const updatePrices = async () => {
    try {
      const prices = await fetchTokenPrices(TESTNET_TOKENS);
      setTokenPrices(prices);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    let active = true;
    void updatePrices();
    const interval = window.setInterval(() => {
      if (active) void updatePrices();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
    setIsLandingView(false);
  };

  const handleLaunchApp = (tab?: ActiveNavTab) => {
    if (tab) {
      if (tab === 'Home') {
        setIsLandingView(true);
        return;
      }
      setActiveTab(tab);
    }
    setIsLandingView(false);
  };

  const handleTabChange = (tab: ActiveNavTab) => {
    if (tab === 'Home') {
      setIsLandingView(true);
      return;
    }
    setActiveTab(tab);
    setIsLandingView(false);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between selection:bg-[#7342E2]/20 selection:text-[#192837] font-sans">
      {/* ── 1. Full-Viewport Ambient Background Video Layer ── */}
      <video
        className="fixed inset-0 w-full h-full object-cover -z-10 pointer-events-none"
        autoPlay
        muted
        loop
        playsInline
        src="/videos/ambient-coin.mp4"
      />

      {/* ── Persistent Navbar (always visible) ── */}
      <Navbar
        activeTab={isLandingView ? 'Home' : activeTab}
        onTabChange={handleTabChange}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenWallet={() => setIsWalletModalOpen(true)}
        onOpenDocs={() => setIsDocsModalOpen(true)}
        connectedWallet={connectedWallet}
        onDisconnectWallet={() => setConnectedWallet(null)}
      />

      {/* ── 2. View Switching: Landing Hero vs DEX App ── */}
      {isLandingView ? (
        <MorphexHero
          onLaunchApp={handleLaunchApp}
          onOpenDocs={() => setIsDocsModalOpen(true)}
        />
      ) : (
        <div className="min-h-[calc(100vh-56px)] flex flex-col justify-between">
          {/* Main DEX Content Area */}
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 md:py-16">
            {activeTab === 'Trade' && (
              <SwapCard
                sellToken={liveTokens.find((token) => token.address === sellToken.address) || sellToken}
                buyToken={
                  buyToken
                    ? liveTokens.find((token) => token.address === buyToken.address) || buyToken
                    : null
                }
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

            {activeTab === 'Pool' && (
              <PoolView
                connectedWallet={connectedWallet}
                onOpenWallet={() => setIsWalletModalOpen(true)}
              />
            )}

            {activeTab === 'Portfolio' && (
              <PortfolioView
                connectedWallet={connectedWallet}
                onOpenWallet={() => setIsWalletModalOpen(true)}
              />
            )}

            {activeTab === 'Governance' && (
              <GovernanceView
                connectedWallet={connectedWallet}
                onOpenWallet={() => setIsWalletModalOpen(true)}
              />
            )}

            {activeTab === 'Vault' && (
              <div className="w-full max-w-[480px] mx-auto space-y-4">
                {/* Vault Sub-Tabs: Deposit Public | Redeem (Withdraw) | UPI Fiat On-Ramp */}
                <div className="flex rounded-2xl bg-white/90 backdrop-blur-xl p-1 border border-white/80 shadow-xs">
                  <button
                    onClick={() => setVaultSubTab('deposit')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      vaultSubTab === 'deposit'
                        ? 'bg-[#7342E2] text-white shadow-xs'
                        : 'text-[#6B7280] hover:text-[#192837]'
                    }`}
                  >
                    Deposit Public
                  </button>
                  <button
                    onClick={() => setVaultSubTab('redeem')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      vaultSubTab === 'redeem'
                        ? 'bg-[#7342E2] text-white shadow-xs'
                        : 'text-[#6B7280] hover:text-[#192837]'
                    }`}
                  >
                    Redeem (Withdraw)
                  </button>
                  <button
                    onClick={() => setVaultSubTab('onramp')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      vaultSubTab === 'onramp'
                        ? 'bg-[#7342E2] text-white shadow-xs'
                        : 'text-[#6B7280] hover:text-[#192837]'
                    }`}
                  >
                    UPI On-Ramp
                  </button>
                </div>

                {vaultSubTab === 'deposit' && (
                  <VaultView
                    connectedWallet={connectedWallet}
                    onOpenWallet={() => setIsWalletModalOpen(true)}
                  />
                )}
                {vaultSubTab === 'redeem' && (
                  <RedemptionView
                    connectedWallet={connectedWallet}
                    onOpenWallet={() => setIsWalletModalOpen(true)}
                  />
                )}
                {vaultSubTab === 'onramp' && (
                  <OnRampView
                    connectedWallet={connectedWallet}
                    onOpenWallet={() => setIsWalletModalOpen(true)}
                    onViewPortfolio={() => setActiveTab('Portfolio')}
                  />
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── 3. Modals and Overlays ── */}
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
        onConnectSuccess={(walletAddress) => setConnectedWallet(walletAddress || null)}
        connectedWallet={connectedWallet}
      />

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectToken={handleGlobalSelectToken}
      />

      <DocsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
      />
    </div>
  );
}

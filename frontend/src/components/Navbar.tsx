import React, { useState } from 'react';
import {
  Search,
  ChevronDown,
  Menu,
  X,
  Copy,
  Check,
  ExternalLink,
  LogOut,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { MorphexLogo } from './MorphexLogo';
import { ActiveNavTab } from '../types';

interface NavbarProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  onOpenSearch: () => void;
  onOpenWallet: () => void;
  onOpenDocs: () => void;
  connectedWallet: string | null;
  onDisconnectWallet: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSearch,
  onOpenWallet,
  onOpenDocs,
  connectedWallet,
  onDisconnectWallet,
}) => {
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const tabs: Array<{ id: ActiveNavTab; label: string }> = [
    { id: 'Home', label: 'Home' },
    { id: 'Trade', label: 'Trade' },
    { id: 'Explore', label: 'Explore' },
    { id: 'Pool', label: 'Pool' },
    { id: 'Vault', label: 'Vault' },
    { id: 'Portfolio', label: 'Portfolio' },
    { id: 'Governance', label: 'Governance' },
  ];

  const handleCopy = () => {
    if (!connectedWallet) return;
    navigator.clipboard.writeText(connectedWallet);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const truncatedAddress = connectedWallet
    ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
    : '';

  return (
    <header
      id="dex-navbar"
      className="sticky top-0 z-30 w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white/60 shadow-xs"
    >
      {/* ── Left section: Morphex Brand & Navigation Tabs ── */}
      <div className="flex items-center gap-6 lg:gap-8">
        {/* Brand Logo */}
        <button
          id="dex-logo-btn"
          onClick={() => onTabChange('Home')}
          className="flex items-center gap-2 group cursor-pointer focus:outline-none transition-transform duration-200 hover:scale-[1.02]"
          aria-label="Morphex Home"
        >
          <MorphexLogo variant="full" theme="dark" size={30} />
        </button>

        {/* Navigation Tabs (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 p-1 bg-[#F3F4F6]/70 rounded-full border border-gray-200/50">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-${tab.id.toLowerCase()}`}
                onClick={() => onTabChange(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#7342E2] text-white shadow-xs'
                    : 'text-[#4B5563] hover:text-[#192837] hover:bg-white/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <button
            onClick={onOpenDocs}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#4B5563] hover:text-[#192837] hover:bg-white/80 transition-all duration-200 cursor-pointer flex items-center gap-1"
          >
            <span>Docs</span>
            <BookOpen className="w-3 h-3 text-[#9CA3AF]" />
          </button>
        </nav>
      </div>

      {/* ── Right Controls: Search, Network, Wallet ── */}
      <div className="flex items-center gap-2.5">
        {/* Global Search Button (⌘K) */}
        <button
          id="dex-search-btn"
          onClick={onOpenSearch}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-white/80 hover:bg-white text-[#6B7280] hover:text-[#192837] shadow-xs transition-colors text-xs"
        >
          <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
          <span className="hidden sm:inline font-medium">Search tokens</span>
          <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-[#9CA3AF] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
            ⌘K
          </kbd>
        </button>

        {/* Network Indicator Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-white/80 text-xs font-semibold text-[#192837] shadow-xs">
          <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span>Sepolia</span>
        </div>

        {/* Web3 Connect Wallet Button */}
        {!connectedWallet ? (
          <button
            id="dex-nav-connect-btn"
            onClick={onOpenWallet}
            className="px-4 py-2 rounded-full font-bold text-xs text-white bg-[#7342E2] hover:bg-[#6533D6] active:bg-[#5829B8] shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>Connect Wallet</span>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowWalletMenu(!showWalletMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-[#E5E7EB] shadow-xs text-xs font-semibold text-[#192837] transition-all cursor-pointer"
            >
              {/* Identicon circular avatar */}
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#7342E2] to-[#A78BFA] flex items-center justify-center text-[10px] font-bold text-white uppercase">
                {connectedWallet.slice(2, 4)}
              </div>
              <span className="font-mono text-xs">{truncatedAddress}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
            </button>

            {/* Connected Wallet Dropdown */}
            {showWalletMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-[#E5E7EB] p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                    Connected Account
                  </div>
                  <div className="font-mono text-xs font-semibold text-[#192837] mt-0.5 truncate">
                    {connectedWallet}
                  </div>
                </div>

                <div className="mt-1 space-y-0.5">
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#374151] hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {copiedAddr ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedAddr ? 'Copied to clipboard' : 'Copy Address'}
                    </span>
                  </button>

                  <a
                    href={`https://sepolia.etherscan.io/address/${connectedWallet}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#374151] hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-[#6B7280]" />
                      View on Etherscan
                    </span>
                  </a>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={() => {
                      setShowWalletMenu(false);
                      onDisconnectWallet();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#DC2626] hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile menu toggle */}
        <button
          id="mobile-nav-toggle-btn"
          onClick={() => setShowMobileNav(!showMobileNav)}
          className="lg:hidden p-2 rounded-xl border border-[#E5E7EB] bg-white/80 text-[#192837]"
          aria-label="Toggle mobile menu"
        >
          {showMobileNav ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Mobile Nav Drawer ── */}
      {showMobileNav && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-2xl border-b border-[#E5E7EB] p-4 shadow-xl z-40 flex flex-col gap-1.5 animate-in slide-in-from-top-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setShowMobileNav(false);
              }}
              className={`p-2.5 rounded-xl text-left font-semibold text-xs ${
                activeTab === tab.id ? 'bg-[#7342E2] text-white' : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => {
              setShowMobileNav(false);
              onOpenDocs();
            }}
            className="p-2.5 rounded-xl text-left font-semibold text-xs text-[#4B5563] hover:bg-gray-100 flex items-center justify-between"
          >
            <span>Docs</span>
            <BookOpen className="w-3.5 h-3.5 text-[#9CA3AF]" />
          </button>
        </div>
      )}
    </header>
  );
};

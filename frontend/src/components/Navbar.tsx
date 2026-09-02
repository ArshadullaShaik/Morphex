import React, { useState } from 'react';
import { Search, MoreHorizontal, ExternalLink, HelpCircle, FileText, Globe, Layers, Sparkles, Menu, X, ChevronDown } from 'lucide-react';
import { ActiveNavTab } from '../types';

interface NavbarProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  onOpenSearch: () => void;
  onOpenWallet: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSearch,
  onOpenWallet,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  return (
    <header 
      id="dex-navbar" 
      className="relative z-30 w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between border-b border-[#E5E7EB] bg-white text-[#0D111C]"
    >
      {/* Left section: Uniswap Brand & Navigation Links */}
      <div className="flex items-center gap-6 lg:gap-8">
        {/* Brand Logo */}
        <button
          id="dex-logo-btn"
          onClick={() => onTabChange('Trade')}
          className="flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="w-8 h-8 rounded-full bg-[#00E5FF] flex items-center justify-center shadow-sm">
            {/* Uniswap iconic unicorn horn vector */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M12 2L14.2 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.8 8.5L12 2Z" 
                fill="#0D111C" 
              />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-[#0D111C]">
            Uniswap
          </span>
        </button>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            id="nav-trade"
            onClick={() => onTabChange('Trade')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'Trade' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#6B7280] hover:text-[#0D111C] hover:bg-[#F9FAFB]'
            }`}
          >
            Trade
          </button>

          <button
            id="nav-explore"
            onClick={() => onTabChange('Explore')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'Explore' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#6B7280] hover:text-[#0D111C] hover:bg-[#F9FAFB]'
            }`}
          >
            Explore
          </button>

          <button
            id="nav-launches"
            onClick={() => onTabChange('Launches')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'Launches' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#6B7280] hover:text-[#0D111C] hover:bg-[#F9FAFB]'
            }`}
          >
            <span>Launches</span>
            <span className="bg-[#00E5FF]/20 text-[#0E7490] text-[10px] font-bold px-1.5 py-0.2 rounded font-mono">
              BETA
            </span>
          </button>

          <button
            id="nav-pool"
            onClick={() => onTabChange('Pool')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'Pool' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#6B7280] hover:text-[#0D111C] hover:bg-[#F9FAFB]'
            }`}
          >
            Pool
          </button>

          <button
            id="nav-vault"
            onClick={() => onTabChange('Vault')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'Vault' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#6B7280] hover:text-[#0D111C] hover:bg-[#F9FAFB]'
            }`}
          >
            Vault
          </button>

          <button
            id="nav-portfolio"
            onClick={() => onTabChange('Portfolio')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'Portfolio' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#6B7280] hover:text-[#0D111C] hover:bg-[#F9FAFB]'
            }`}
          >
            Portfolio
          </button>
        </nav>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Search button */}
        <button
          id="dex-search-btn"
          onClick={onOpenSearch}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white text-[#6B7280] hover:text-[#0D111C] transition-colors text-sm"
        >
          <Search className="w-4 h-4 text-[#9CA3AF]" />
          <span className="hidden lg:inline text-xs font-medium text-[#6B7280]">Search tokens and NFT collections</span>
          <kbd className="hidden lg:inline-flex items-center text-[10px] font-mono text-[#9CA3AF] bg-white px-1.5 py-0.5 rounded border border-[#E5E7EB]">
            /
          </kbd>
        </button>

        {/* Network indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-semibold text-[#374151]">
          <div className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Sepolia</span>
        </div>

        {/* More Menu */}
        <div className="relative">
          <button
            id="dex-more-options-btn"
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#0D111C] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div 
              id="dex-more-dropdown" 
              className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-2 z-50 animate-in fade-in"
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Ecosystem
              </div>
              <button 
                onClick={() => { setShowMenu(false); onTabChange('Explore'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] text-left transition-colors"
              >
                <Globe className="w-4 h-4 text-[#6B7280]" />
                Analytics & Markets
              </button>
              <button 
                onClick={() => { setShowMenu(false); onTabChange('Pool'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] text-left transition-colors"
              >
                <Layers className="w-4 h-4 text-[#6B7280]" />
                Liquidity Pools
              </button>
              <div className="my-1 border-t border-[#F3F4F6]" />
              <button 
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] text-left transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#9CA3AF]" />
                  Documentation
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-[#9CA3AF]" />
              </button>
              <button 
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] text-left transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-[#9CA3AF]" />
                  Help Center
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-[#9CA3AF]" />
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Button: 'Get started' / 'Connect' */}
        <button
          id="dex-nav-get-started-btn"
          onClick={onOpenWallet}
          className="px-4 py-2 rounded-full font-bold text-sm text-[#0D111C] bg-[#00E5FF] hover:bg-[#00D2EA] active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
        >
          <span>Get started</span>
        </button>

        {/* Mobile menu toggle */}
        <button
          id="mobile-nav-toggle-btn"
          onClick={() => setShowMobileNav(!showMobileNav)}
          className="md:hidden p-2 rounded-xl border border-[#E5E7EB] bg-white text-[#374151]"
        >
          {showMobileNav ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {showMobileNav && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-[#E5E7EB] p-4 shadow-xl z-40 flex flex-col gap-1.5">
          <button
            onClick={() => { onTabChange('Trade'); setShowMobileNav(false); }}
            className={`p-2.5 rounded-xl text-left font-semibold text-sm ${activeTab === 'Trade' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#4B5563]'}`}
          >
            Trade
          </button>
          <button
            onClick={() => { onTabChange('Explore'); setShowMobileNav(false); }}
            className={`p-2.5 rounded-xl text-left font-semibold text-sm ${activeTab === 'Explore' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#4B5563]'}`}
          >
            Explore
          </button>
          <button
            onClick={() => { onTabChange('Launches'); setShowMobileNav(false); }}
            className={`p-2.5 rounded-xl text-left font-semibold text-sm ${activeTab === 'Launches' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#4B5563]'}`}
          >
            Launches
          </button>
          <button
            onClick={() => { onTabChange('Pool'); setShowMobileNav(false); }}
            className={`p-2.5 rounded-xl text-left font-semibold text-sm ${activeTab === 'Pool' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#4B5563]'}`}
          >
            Pool
          </button>
          <button
            onClick={() => { onTabChange('Portfolio'); setShowMobileNav(false); }}
            className={`p-2.5 rounded-xl text-left font-semibold text-sm ${activeTab === 'Portfolio' ? 'bg-[#F3F4F6] text-[#0D111C]' : 'text-[#4B5563]'}`}
          >
            Portfolio
          </button>
        </div>
      )}
    </header>
  );
};

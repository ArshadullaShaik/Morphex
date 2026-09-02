import React, { useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { Token } from '../types';
import { TESTNET_TOKENS } from '../data/tokens';
import { TokenIcon } from './TokenIcon';

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token) => void;
  selectedTokenSymbol?: string;
  modalTitle?: string;
  tokens?: Token[];
}

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectToken,
  selectedTokenSymbol,
  modalTitle = 'Select a token',
  tokens = TESTNET_TOKENS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredTokens = tokens.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      id="token-select-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        id="token-select-modal"
        className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E5E7EB] p-5 overflow-hidden animate-in zoom-in-95 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <h2 className="text-base font-bold text-[#0D111C]">{modalTitle}</h2>
          <button
            id="close-token-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#0D111C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            id="token-search-input"
            type="text"
            placeholder="Search name or paste address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-xs text-[#0D111C] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#9CA3AF]"
            autoFocus
          />
        </div>

        {/* Popular Token Quick Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tokens.slice(0, 5).map((token) => (
            <button
              key={`quick-${token.symbol}`}
              id={`quick-select-${token.symbol.toLowerCase()}`}
              disabled={!token.available || !token.address}
              onClick={() => {
                if (!token.available || !token.address) return;
                onSelectToken(token);
                onClose();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${
                selectedTokenSymbol === token.symbol
                  ? 'border-[#0D111C] bg-[#F3F4F6] text-[#0D111C]'
                  : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-[#D1D5DB]'
              } ${(!token.available || !token.address) ? 'opacity-55 cursor-not-allowed' : ''}`}
            >
              <TokenIcon symbol={token.symbol} size="sm" />
              <span>{token.symbol}</span>
            </button>
          ))}
        </div>

        {/* Token List */}
        <div 
          id="token-search-results-list"
          className="mt-3 overflow-y-auto divide-y divide-[#F3F4F6] flex-1 max-h-[360px] -mx-2 px-2"
        >
          {filteredTokens.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6B7280]">
              No tokens found matching "{searchQuery}"
            </div>
          ) : (
            filteredTokens.map((token) => {
              const isSelected = selectedTokenSymbol === token.symbol;
              return (
                <button
                  key={token.symbol}
                  id={`token-row-${token.symbol.toLowerCase()}`}
                  onClick={() => {
                    if (!token.available || !token.address) return;
                    onSelectToken(token);
                    onClose();
                  }}
                  disabled={!token.available || !token.address}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-colors text-left ${
                    isSelected ? 'bg-[#F3F4F6]' : 'hover:bg-[#F9FAFB]'
                  } ${(!token.available || !token.address) ? 'opacity-55 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={token.symbol} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[#0D111C]">{token.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#0E7490]" />}
                      </div>
                      <span className="text-[11px] text-[#6B7280] font-mono">{token.symbol}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    {(!token.available || !token.address) && (
                      <div className="text-[11px] font-semibold text-[#9A3412]">Not configured</div>
                    )}
                    {token.balance !== undefined && (
                      <div className="text-xs font-semibold text-[#0D111C] font-mono">
                        {token.balance}
                      </div>
                    )}
                    <div className="text-[11px] text-[#6B7280] font-mono">
                      ${token.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

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

  const filteredTokens = tokens.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      id="token-select-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="token-select-modal"
        className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/80 p-5 overflow-hidden animate-in zoom-in-95 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <h2 className="text-base font-bold text-[#192837]">{modalTitle}</h2>
          <button
            id="close-token-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-[#6B7280] hover:text-[#192837] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            id="token-search-input"
            type="text"
            placeholder="Search token name or address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-xs text-[#192837] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#7342E2]"
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
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                selectedTokenSymbol === token.symbol
                  ? 'border-[#7342E2] bg-[#7342E2]/10 text-[#7342E2]'
                  : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-[#7342E2]/40'
              } ${!token.available || !token.address ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                    isSelected ? 'bg-[#7342E2]/10' : 'hover:bg-[#F9FAFB]'
                  } ${!token.available || !token.address ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={token.symbol} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#192837]">{token.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#7342E2]" />}
                      </div>
                      <span className="text-[11px] text-[#6B7280] font-mono">{token.symbol}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    {!token.available || !token.address ? (
                      <div className="text-[11px] font-semibold text-[#DC2626]">Not deployed</div>
                    ) : null}
                    {token.balance !== undefined && (
                      <div className="text-xs font-bold text-[#192837] font-mono">{token.balance}</div>
                    )}
                    <div className="text-[11px] text-[#6B7280] font-mono">
                      $
                      {token.priceUSD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
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

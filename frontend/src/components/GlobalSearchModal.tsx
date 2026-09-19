import React, { useState } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { POPULAR_TOKENS } from '../data/tokens';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectToken,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredTokens = POPULAR_TOKENS.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.symbol.toLowerCase().includes(query.toLowerCase()) ||
      t.address.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      id="global-search-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/50 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="global-search-modal"
        className="relative w-full max-w-xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/80 overflow-hidden animate-in zoom-in-95 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E5E7EB]">
          <Search className="w-5 h-5 text-[#9CA3AF] mr-3" />
          <input
            type="text"
            placeholder="Search tokens, pools, and contracts... (⌘K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-[#192837] placeholder:text-[#9CA3AF] focus:outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-[#6B7280] hover:text-[#192837] transition-colors ml-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results / Suggestions */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          <div className="px-3 py-2 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
            {query ? 'Search Results' : 'Popular Tokens & Protocols'}
          </div>

          <div className="divide-y divide-[#F3F4F6]">
            {filteredTokens.map((token) => {
              const change = token.change24h ?? 0;
              return (
                <button
                  key={token.symbol}
                  onClick={() => {
                    onSelectToken(token);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-[#F9FAFB] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={token.symbol} size="md" />
                    <div>
                      <div className="font-bold text-xs text-[#192837]">{token.name}</div>
                      <div className="text-[11px] text-[#6B7280] font-mono">{token.symbol}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#192837] font-mono">
                        $
                        {token.priceUSD.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div
                        className={`text-[11px] font-mono font-semibold ${
                          change >= 0 ? 'text-[#10B981]' : 'text-[#DC2626]'
                        }`}
                      >
                        {change >= 0 ? '+' : ''}
                        {change}%
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

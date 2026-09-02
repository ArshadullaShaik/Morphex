import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { POPULAR_TOKENS } from '../data/tokens';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';

interface ExploreViewProps {
  onSelectToken: (token: Token) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ onSelectToken }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'gainers'>('all');

  const filteredTokens = POPULAR_TOKENS.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'gainers') return (t.change24h ?? 0) > 0;
    return true;
  });

  return (
    <div id="dex-explore-view" className="w-full max-w-5xl mx-auto py-2">
      {/* Header with Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0D111C]">Explore Tokens</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">Real-time prices, volume, and verified liquidity pools</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by token or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#0D111C] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#9CA3AF]"
            />
          </div>

          <div className="flex items-center p-0.5 bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'all' ? 'bg-white text-[#0D111C] shadow-sm' : 'text-[#6B7280] hover:text-[#0D111C]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('gainers')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'gainers' ? 'bg-white text-[#0D111C] shadow-sm' : 'text-[#6B7280] hover:text-[#0D111C]'
              }`}
            >
              Gainers
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">24h Change</th>
                <th className="py-3 px-4">24h Volume</th>
                <th className="py-3 px-4">Total Liquidity</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredTokens.map((token, idx) => {
                const change = token.change24h ?? 0;
                const volume = token.volume24h ?? 0;

                return (
                  <tr 
                    key={token.symbol} 
                    className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                    onClick={() => onSelectToken(token)}
                  >
                    <td className="py-3.5 px-4 text-center text-[#9CA3AF] font-medium">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <TokenIcon symbol={token.symbol} size="md" />
                        <div>
                          <div className="font-semibold text-[#0D111C] flex items-center gap-1.5">
                            <span>{token.name}</span>
                            <span className="text-[#6B7280] font-normal text-[11px]">{token.symbol}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#0D111C] font-mono">
                      ${token.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: token.priceUSD < 1 ? 4 : 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}>
                        {change >= 0 ? '+' : ''}{change}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#4B5563] font-mono">
                      ${(volume / 1_000_000).toFixed(1)}M
                    </td>
                    <td className="py-3.5 px-4 text-[#4B5563] font-mono">
                      ${(volume * 3.8 / 1_000_000).toFixed(1)}M
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectToken(token);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#0D111C] transition-colors"
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

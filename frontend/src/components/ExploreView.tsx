import React, { useState, useEffect } from 'react';
import { Search, Layers, Sparkles, TrendingUp } from 'lucide-react';
import { EXPLORE_L2_TOKENS } from '../data/tokens';
import { getTokenTotalLiquidity } from '../data/liquidityStore';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';

interface ExploreViewProps {
  onSelectToken: (token: Token) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ onSelectToken }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'morphex' | 'l2' | 'gainers'>('all');
  const [, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshKey((k) => k + 1);
    window.addEventListener('liquidity-updated', handleUpdate);
    return () => window.removeEventListener('liquidity-updated', handleUpdate);
  }, []);

  const filteredTokens = EXPLORE_L2_TOKENS.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.chain && t.chain.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (filter === 'morphex') return t.chain?.includes('Morphex') || t.symbol === 'MORPH' || t.symbol === 'mUSD';
    if (filter === 'l2') return !t.chain?.includes('Morphex') && t.symbol !== 'MORPH' && t.symbol !== 'mUSD';
    if (filter === 'gainers') return (t.change24h ?? 0) > 0;
    return true;
  });

  return (
    <div id="dex-explore-view" className="w-full max-w-5xl mx-auto py-2">
      {/* Header with Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#7342E2]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7342E2] mb-2 border border-[#7342E2]/20">
            <Layers className="w-3 h-3 text-[#7342E2]" />
            L2 Ecosystem & Morphex Protocols
          </div>
          <h2 className="text-2xl font-extrabold text-[#192837] tracking-tight">
            Explore Ecosystem & Tokens
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Real-time market analytics, 24h trading volume, and confidential liquidity pool depth.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by token or chain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/90 border border-[#E5E7EB] rounded-xl text-xs text-[#192837] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#7342E2] shadow-xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center p-1 bg-white/80 backdrop-blur-md rounded-xl border border-[#E5E7EB] text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#7342E2] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#192837]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('morphex')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                filter === 'morphex'
                  ? 'bg-[#7342E2] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#192837]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Morphex
            </button>
            <button
              onClick={() => setFilter('l2')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filter === 'l2'
                  ? 'bg-[#7342E2] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#192837]'
              }`}
            >
              L2 Chains
            </button>
            <button
              onClick={() => setFilter('gainers')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filter === 'gainers'
                  ? 'bg-[#7342E2] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#192837]'
              }`}
            >
              Gainers
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB]/90 border-b border-[#E5E7EB] text-[#6B7280] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Token & Network</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4">24h Change</th>
                <th className="py-3.5 px-4">24h Volume</th>
                <th className="py-3.5 px-4">Confidential Liquidity</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredTokens.map((token, idx) => {
                const change = token.change24h ?? 0;
                const volume = token.volume24h ?? 0;
                const totalLiqUSD = getTokenTotalLiquidity(token.symbol, token.priceUSD);
                const isMorphex =
                  token.chain?.includes('Morphex') || token.symbol === 'MORPH' || token.symbol === 'mUSD';

                return (
                  <tr
                    key={token.symbol}
                    className="hover:bg-[#F9FAFB]/80 transition-colors cursor-pointer"
                    onClick={() => onSelectToken(token)}
                  >
                    <td className="py-3.5 px-4 text-center text-[#9CA3AF] font-medium">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <TokenIcon symbol={token.symbol} size="md" />
                        <div>
                          <div className="font-bold text-[#192837] flex items-center gap-1.5">
                            <span>{token.name}</span>
                            <span className="text-[#6B7280] font-normal text-[11px]">{token.symbol}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isMorphex
                                  ? 'bg-[#7342E2]/15 text-[#7342E2]'
                                  : 'bg-[#F1F5F9] text-[#475569]'
                              }`}
                            >
                              {token.chain ?? 'Layer 2'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#192837] font-mono">
                      $
                      {token.priceUSD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: token.priceUSD < 0.01 ? 4 : 2,
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-0.5 font-bold ${
                          change >= 0 ? 'text-[#10B981]' : 'text-[#DC2626]'
                        }`}
                      >
                        {change >= 0 ? '+' : ''}
                        {change}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#4B5563] font-mono">
                      ${(volume / 1_000_000).toFixed(2)}M
                    </td>
                    <td className="py-3.5 px-4 text-[#047857] font-semibold font-mono">
                      $
                      {totalLiqUSD >= 1_000_000
                        ? `${(totalLiqUSD / 1_000_000).toFixed(2)}M`
                        : totalLiqUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectToken(token);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#7342E2]/10 hover:bg-[#7342E2] text-[#7342E2] hover:text-white transition-all cursor-pointer"
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

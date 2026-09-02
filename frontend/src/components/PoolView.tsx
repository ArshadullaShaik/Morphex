import React from 'react';
import { Plus } from 'lucide-react';
import { TokenIcon } from './TokenIcon';

export const PoolView: React.FC = () => {
  const pools = [
    {
      pair: 'ETH / USDC',
      token0: 'ETH',
      token1: 'USDC',
      feeTier: '0.05%',
      tvl: '$342.5M',
      apr: '18.4%',
      volume24h: '$84.2M',
    },
    {
      pair: 'WBTC / ETH',
      token0: 'WBTC',
      token1: 'ETH',
      feeTier: '0.30%',
      tvl: '$210.8M',
      apr: '12.6%',
      volume24h: '$45.1M',
    },
    {
      pair: 'ETH / USDT',
      token0: 'ETH',
      token1: 'USDT',
      feeTier: '0.05%',
      tvl: '$180.2M',
      apr: '16.9%',
      volume24h: '$62.8M',
    },
    {
      pair: 'UNI / ETH',
      token0: 'UNI',
      token1: 'ETH',
      feeTier: '0.30%',
      tvl: '$94.1M',
      apr: '24.2%',
      volume24h: '$18.3M',
    },
  ];

  return (
    <div id="dex-pool-view" className="w-full max-w-4xl mx-auto py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#0D111C]">Liquidity Pools</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">Provide liquidity to earn trading fees and active pool rewards</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-[#0D111C] bg-[#00E5FF] hover:bg-[#00D2EA] shadow-sm transition-all self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>New Position</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Pool</th>
                <th className="py-3 px-4">Fee Tier</th>
                <th className="py-3 px-4">TVL</th>
                <th className="py-3 px-4">24h Volume</th>
                <th className="py-3 px-4">Est. APR</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {pools.map((p) => (
                <tr key={p.pair} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-2">
                        <TokenIcon symbol={p.token0} size="md" />
                        <TokenIcon symbol={p.token1} size="md" />
                      </div>
                      <span className="font-semibold text-[#0D111C]">{p.pair}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F3F4F6] text-[#4B5563]">
                      {p.feeTier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#0D111C] font-mono">{p.tvl}</td>
                  <td className="py-3.5 px-4 text-[#4B5563] font-mono">{p.volume24h}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-[#10B981] font-mono">{p.apr}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#0D111C] transition-all">
                      Deposit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

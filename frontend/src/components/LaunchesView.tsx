import React from 'react';
import { Sparkles, Clock, ExternalLink } from 'lucide-react';

export const LaunchesView: React.FC = () => {
  const launchProjects = [
    {
      name: 'Aether Protocol',
      symbol: 'AETH',
      description: 'Decentralized cross-chain AI inference and compute verification.',
      stage: 'Live Fair Launch',
      totalRaised: '$2.4M / $3.0M',
      timeRemaining: '18h 42m',
      badgeColor: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    },
    {
      name: 'CyberLink Oracle',
      symbol: 'CYBER',
      description: 'Zero-latency financial data streaming for L2 & L3 rollups.',
      stage: 'Upcoming',
      totalRaised: 'Starts Tomorrow',
      timeRemaining: '1d 06h',
      badgeColor: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]',
    },
    {
      name: 'HyperScale Vaults',
      symbol: 'HPS',
      description: 'Automated delta-neutral yield optimization with zero management fees.',
      stage: 'Whitelisted',
      totalRaised: '$4.8M',
      timeRemaining: '3d 12h',
      badgeColor: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
    },
  ];

  return (
    <div id="dex-launches-view" className="w-full max-w-4xl mx-auto py-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#0D111C]">Token Launches</h2>
            <span className="bg-[#00E5FF]/20 text-[#0E7490] text-[10px] font-bold px-2 py-0.5 rounded font-mono">
              BETA
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5">Discover and participate in verified early token distributions</p>
        </div>
        <button className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-xs font-semibold text-[#0D111C] shadow-sm">
          Submit Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {launchProjects.map((p) => (
          <div
            key={p.name}
            className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-sm flex flex-col justify-between hover:border-[#D1D5DB] transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${p.badgeColor}`}>
                  {p.stage}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF] font-medium">
                  <Clock className="w-3 h-3" />
                  {p.timeRemaining}
                </span>
              </div>

              <h3 className="text-base font-bold text-[#0D111C]">{p.name}</h3>
              <span className="text-xs font-mono text-[#0E7490] font-semibold">${p.symbol}</span>
              <p className="text-xs text-[#6B7280] mt-2 leading-relaxed">{p.description}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#F3F4F6] flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Distribution</div>
                <div className="text-xs font-bold text-[#0D111C]">{p.totalRaised}</div>
              </div>
              <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00E5FF] hover:bg-[#00D2EA] text-[#0D111C] shadow-sm">
                View Pool
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

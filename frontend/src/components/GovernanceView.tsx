import React, { useState } from 'react';
import {
  Vote,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Landmark,
  FileCheck2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  LoaderCircle,
  ExternalLink,
} from 'lucide-react';
import { GovernanceProposal } from '../types';

interface GovernanceViewProps {
  connectedWallet: string | null;
  onOpenWallet: () => void;
}

const INITIAL_PROPOSALS: GovernanceProposal[] = [
  {
    id: 'MIP-04',
    title: 'Deploy Confidential FHE Flash-Loan Guard & Dynamic Slippage Protection',
    description:
      'Implements an encrypted circuit on the Zama FHEVM coprocessor to prevent cross-block sandwich attacks on large confidential trades by dynamically throttling pool volume bounds.',
    proposer: '0x32A4...B89F',
    status: 'Active',
    category: 'Security',
    startDate: 'Sep 18, 2026',
    endDate: 'Sep 25, 2026',
    forVotes: 1420500,
    againstVotes: 32400,
    abstainVotes: 12000,
    quorum: 85,
  },
  {
    id: 'MIP-03',
    title: 'Incentivize cUSDC / cWETH Confidential Liquidity Pair with 50,000 MORPH',
    description:
      'Allocate 50,000 MORPH from the community treasury over 90 days to bootstrap shielded liquidity depth in the newly deployed cUSDC/cWETH pool.',
    proposer: '0x88F2...91C2',
    status: 'Active',
    category: 'Treasury',
    startDate: 'Sep 16, 2026',
    endDate: 'Sep 23, 2026',
    forVotes: 890400,
    againstVotes: 110200,
    abstainVotes: 45000,
    quorum: 72,
  },
  {
    id: 'MIP-02',
    title: 'Integrate UPI INR Direct On-Ramp Relayer with Automated FHE Minting',
    description:
      'Upgrade the fiat bridge contract to support zero-fee Razorpay and BHIM UPI QR settlements, auto-minting confidential testnet assets directly to user accounts.',
    proposer: '0x44B1...77A0',
    status: 'Passed',
    category: 'FHEVM Relayer',
    startDate: 'Sep 02, 2026',
    endDate: 'Sep 09, 2026',
    forVotes: 2450000,
    againstVotes: 4100,
    abstainVotes: 18000,
    quorum: 96,
  },
  {
    id: 'MIP-01',
    title: 'Establish Morphex DAO Constitution & 7-Day Encrypted Voting Sessions',
    description:
      'Ratify the foundational governance framework requiring all votes to be submitted via EIP-712 encrypted homomorphic ciphertexts to prevent voter coercion and front-running.',
    proposer: '0x1928...37FF',
    status: 'Executed',
    category: 'Protocol',
    startDate: 'Aug 20, 2026',
    endDate: 'Aug 27, 2026',
    forVotes: 3820000,
    againstVotes: 0,
    abstainVotes: 5000,
    quorum: 99,
  },
];

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [proposals, setProposals] = useState<GovernanceProposal[]>(INITIAL_PROPOSALS);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Passed' | 'Executed'>('All');
  const [votingOnId, setVotingOnId] = useState<string | null>(null);
  const [votingChoice, setVotingChoice] = useState<'for' | 'against' | 'abstain' | null>(null);
  const [votedProposals, setVotedProposals] = useState<Record<string, 'for' | 'against' | 'abstain'>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<{ id: string; text: string } | null>(null);

  const filteredProposals = proposals.filter((p) => {
    if (filter === 'All') return true;
    return p.status === filter;
  });

  const handleVote = async (proposalId: string, choice: 'for' | 'against' | 'abstain') => {
    if (!connectedWallet) {
      onOpenWallet();
      return;
    }

    setVotingOnId(proposalId);
    setVotingChoice(choice);
    setFeedbackMsg(null);

    // Simulate encrypting the vote with Zama FHEVM
    setTimeout(() => {
      setProposals((prev) =>
        prev.map((p) => {
          if (p.id !== proposalId) return p;
          const delta = 1000;
          return {
            ...p,
            forVotes: choice === 'for' ? p.forVotes + delta : p.forVotes,
            againstVotes: choice === 'against' ? p.againstVotes + delta : p.againstVotes,
            abstainVotes: choice === 'abstain' ? p.abstainVotes + delta : p.abstainVotes,
          };
        }),
      );
      setVotedProposals((prev) => ({ ...prev, [proposalId]: choice }));
      setVotingOnId(null);
      setVotingChoice(null);
      setFeedbackMsg({
        id: proposalId,
        text: `Encrypted vote successfully recorded on-chain via Zama FHEVM!`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    }, 1200);
  };

  return (
    <div id="dex-governance-view" className="w-full max-w-5xl mx-auto py-2 space-y-6">
      {/* ── 1. Top Banner: Encrypted Voting Weight ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl p-6 border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#F3F4F6]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider">
                Confidential Governance Weight
              </span>
              <span className="bg-[#7342E2]/10 text-[#7342E2] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3" /> FHE Encrypted
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#192837] tracking-tight font-mono">
              {connectedWallet ? '1,450.00 MORPH' : 'Connect Wallet'}
            </div>
            <p className="text-xs text-[#6B7280] mt-1">
              {connectedWallet
                ? 'Your voting power is calculated from your encrypted MORPH balance. No one can see your individual vote.'
                : 'Connect your wallet to inspect your encrypted voting power and cast confidential ballots.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!connectedWallet ? (
              <button
                onClick={onOpenWallet}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-[#7342E2] hover:bg-[#6533D6] shadow-sm transition-all"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-semibold text-[#047857] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                <span>Eligible to Vote</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 3 Governance Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>Total Proposals</span>
              <FileCheck2 className="w-4 h-4 text-[#7342E2]" />
            </div>
            <div className="text-2xl font-bold text-[#192837] font-mono">4 Proposals</div>
            <div className="text-[11px] text-[#6B7280] mt-1">2 Active, 2 Concluded</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>Average Quorum</span>
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-2xl font-bold text-[#065F46] font-mono">87.5%</div>
            <div className="text-[11px] text-[#047857] mt-1">High community participation</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>DAO Treasury</span>
              <Landmark className="w-4 h-4 text-[#0284C7]" />
            </div>
            <div className="text-2xl font-bold text-[#0369A1] font-mono">$18,450,000</div>
            <div className="text-[11px] text-[#0284C7] mt-1">Shielded protocol reserves</div>
          </div>
        </div>
      </div>

      {/* ── 2. Proposal Feed Header & Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#192837]">Active & Past Proposals</h2>
          <p className="text-xs text-[#6B7280]">
            Encrypted voting ensures zero voter intimidation, zero bribery, and zero front-running.
          </p>
        </div>

        <div className="flex items-center p-1 bg-white/80 backdrop-blur-lg rounded-xl border border-[#E5E7EB] text-xs">
          {(['All', 'Active', 'Passed', 'Executed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === tab
                  ? 'bg-[#7342E2] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#192837]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Proposal Cards List ── */}
      <div className="space-y-4">
        {filteredProposals.map((proposal) => {
          const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
          const forPct = totalVotes > 0 ? Math.round((proposal.forVotes / totalVotes) * 100) : 0;
          const againstPct = totalVotes > 0 ? Math.round((proposal.againstVotes / totalVotes) * 100) : 0;
          const abstainPct = totalVotes > 0 ? Math.round((proposal.abstainVotes / totalVotes) * 100) : 0;
          const userVote = votedProposals[proposal.id];
          const isVoting = votingOnId === proposal.id;

          return (
            <div
              key={proposal.id}
              className="rounded-3xl bg-white/90 backdrop-blur-2xl p-6 border border-white/80 shadow-[0_12px_36px_rgba(25,40,55,0.05)] hover:border-[#7342E2]/30 transition-all"
            >
              {/* Proposal Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-[#7342E2] bg-[#7342E2]/10 px-2.5 py-1 rounded-lg">
                    {proposal.id}
                  </span>
                  <span className="text-xs font-semibold text-[#64748B] bg-gray-100 px-2.5 py-1 rounded-lg">
                    {proposal.category}
                  </span>
                  <span className="text-xs text-[#9CA3AF]">by {proposal.proposer}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      proposal.status === 'Active'
                        ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                        : proposal.status === 'Passed'
                        ? 'bg-[#7342E2]/10 text-[#7342E2] border border-[#7342E2]/20'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {proposal.status === 'Active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5 animate-pulse" />}
                    {proposal.status}
                  </span>
                  <span className="text-xs text-[#6B7280] flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    Ends {proposal.endDate}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="mt-4">
                <h3 className="text-base font-bold text-[#192837] mb-1.5">{proposal.title}</h3>
                <p className="text-xs text-[#4B5563] leading-relaxed">{proposal.description}</p>
              </div>

              {/* Voting Progress Bar */}
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#059669]">For: {forPct}% ({proposal.forVotes.toLocaleString()} MORPH)</span>
                  <span className="text-[#DC2626]">Against: {againstPct}% ({proposal.againstVotes.toLocaleString()} MORPH)</span>
                  <span className="text-[#64748B]">Abstain: {abstainPct}%</span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                  <div style={{ width: `${forPct}%` }} className="bg-[#10B981] h-full transition-all" />
                  <div style={{ width: `${againstPct}%` }} className="bg-[#DC2626] h-full transition-all" />
                  <div style={{ width: `${abstainPct}%` }} className="bg-gray-300 h-full transition-all" />
                </div>
              </div>

              {/* Feedback Alert */}
              {feedbackMsg?.id === proposal.id && (
                <div className="mt-4 p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-semibold text-[#047857] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Confidential Voting Buttons (Only for Active proposals) */}
              {proposal.status === 'Active' && (
                <div className="mt-5 pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <Lock className="w-3.5 h-3.5 text-[#7342E2]" />
                    <span>Cast an encrypted ballot with your wallet:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVote(proposal.id, 'for')}
                      disabled={isVoting || Boolean(userVote)}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        userVote === 'for'
                          ? 'bg-[#10B981] text-white shadow-xs'
                          : 'bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]'
                      } disabled:opacity-60`}
                    >
                      {isVoting && votingChoice === 'for' ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-3.5 h-3.5" />
                      )}
                      <span>Vote For</span>
                    </button>

                    <button
                      onClick={() => handleVote(proposal.id, 'against')}
                      disabled={isVoting || Boolean(userVote)}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        userVote === 'against'
                          ? 'bg-[#DC2626] text-white shadow-xs'
                          : 'bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5]'
                      } disabled:opacity-60`}
                    >
                      {isVoting && votingChoice === 'against' ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ThumbsDown className="w-3.5 h-3.5" />
                      )}
                      <span>Vote Against</span>
                    </button>

                    <button
                      onClick={() => handleVote(proposal.id, 'abstain')}
                      disabled={isVoting || Boolean(userVote)}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        userVote === 'abstain'
                          ? 'bg-gray-700 text-white shadow-xs'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                      } disabled:opacity-60`}
                    >
                      {isVoting && votingChoice === 'abstain' ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MinusCircle className="w-3.5 h-3.5" />
                      )}
                      <span>Abstain</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

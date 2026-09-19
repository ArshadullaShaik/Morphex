import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ShieldCheck,
  EyeOff,
  Zap,
  Sparkles,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { ActiveNavTab } from '../types';

interface MorphexHeroProps {
  onLaunchApp: (tab?: ActiveNavTab) => void;
  onOpenDocs: () => void;
}

export const MorphexHero: React.FC<MorphexHeroProps> = ({
  onLaunchApp,
  onOpenDocs,
}) => {
  return (
    <div className="relative min-h-[calc(100vh-56px)] w-full flex flex-col justify-between overflow-x-hidden selection:bg-[#7342E2]/20 selection:text-[#192837]">
      {/* ── Hero Body & Visual Hook ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 max-w-5xl mx-auto text-center py-12 sm:py-16 md:py-20">
        {/* Protocol Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_4px_20px_rgba(25,40,55,0.06)] text-xs font-semibold text-[#192837] mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-mono text-[11px] text-[#7342E2] font-bold">FHEVM v0.5</span>
          <span className="text-[#9CA3AF]">|</span>
          <span className="text-[#4B5563]">Powered by Zama Fully Homomorphic Encryption</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#192837] tracking-tight leading-[1.08] max-w-4xl"
        >
          Trade in Private with{' '}
          <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#7342E2] via-[#8E5FF5] to-[#5829B8]">
            Fully Encrypted
          </span>{' '}
          DeFi
        </motion.h1>

        {/* Sub-headline / Explainer */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg md:text-xl text-[#4B5563] max-w-2xl font-normal leading-relaxed"
        >
          Execute swaps, manage liquidity, and participate in governance with complete end-to-end confidentiality. Zero front-running, zero sandwich attacks, and mathematically verified on-chain privacy.
        </motion.p>

        {/* Hero Action CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 w-full sm:w-auto"
        >
          <button
            onClick={() => onLaunchApp('Trade')}
            className="group w-full sm:w-auto px-8 py-4 rounded-full font-bold text-sm sm:text-base text-white bg-[#7342E2] hover:bg-[#6533D6] active:bg-[#5829B8] shadow-[0_12px_32px_-4px_rgba(115,66,226,0.45)] hover:shadow-[0_16px_36px_-4px_rgba(115,66,226,0.6)] transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer"
          >
            <span>Launch App</span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </div>
          </button>

          <button
            onClick={() => onLaunchApp('Explore')}
            className="w-full sm:w-auto px-7 py-4 rounded-full font-semibold text-sm sm:text-base text-[#192837] bg-white/85 hover:bg-white border border-white/80 shadow-[0_4px_16px_rgba(25,40,55,0.06)] hover:shadow-[0_8px_24px_rgba(25,40,55,0.08)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#7342E2]" />
            <span>Explore Ecosystem</span>
          </button>
        </motion.div>

        {/* ── Four Feature Highlights Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-14 sm:mt-18 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left"
        >
          <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_8px_30px_rgba(25,40,55,0.04)] hover:border-[#7342E2]/30 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-[#7342E2]/10 flex items-center justify-center text-[#7342E2] mb-3 group-hover:scale-110 transition-transform">
              <EyeOff className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#192837] mb-1">Confidential Swaps</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Amounts and balances remain encrypted on-chain. Trade freely without revealing trade size or intent.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_8px_30px_rgba(25,40,55,0.04)] hover:border-[#7342E2]/30 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center text-[#10B981] mb-3 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#192837] mb-1">Zero Front-Running</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              FHE prevents mempool sniffing and predatory MEV bots from sandwiching your confidential orders.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_8px_30px_rgba(25,40,55,0.04)] hover:border-[#7342E2]/30 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-[#7342E2]/10 flex items-center justify-center text-[#7342E2] mb-3 group-hover:scale-110 transition-transform">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#192837] mb-1">Zama FHEVM Powered</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Constant product AMM invariant ($x \cdot y = k$) executed directly over homomorphic ciphertexts.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_8px_30px_rgba(25,40,55,0.04)] hover:border-[#7342E2]/30 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-[#0284C7]/10 flex items-center justify-center text-[#0284C7] mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#192837] mb-1">UPI Fiat On-Ramp</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Instant settlement in INR via QR code & UPI, directly minting confidential testnet tokens to your wallet.
            </p>
          </div>
        </motion.div>
      </main>

      {/* ── Hero Footer ── */}
      <footer className="relative z-20 w-full px-4 sm:px-8 py-6 border-t border-white/50 bg-white/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <span>Protected by Zama FHEVM & Fully Homomorphic Encryption</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="font-mono">v1.2.4-confidential</span>
            <span>•</span>
            <span>Sepolia Testnet (11155111)</span>
            <span>•</span>
            <button onClick={onOpenDocs} className="hover:text-[#192837] transition-colors underline">
              Documentation
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};


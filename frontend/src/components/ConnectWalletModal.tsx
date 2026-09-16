import React, { useState } from 'react';
import { X, CheckCircle2, Loader2, ArrowRight, LogOut, ShieldCheck } from 'lucide-react';
import { connectWallet } from '../morphex';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSuccess: (walletName: string) => void;
  connectedWallet: string | null;
}

/* ── Wallet brand SVG icons ── */

const MetaMaskIcon = () => (
  <svg viewBox="0 0 318.6 318.6" fill="none" className="w-full h-full p-1">
    <rect width="318.6" height="318.6" rx="64" fill="#F6851B" fillOpacity="0.12" />
    <path fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" d="m274.1 35.5-99.5 73.9L193 65.8z" />
    <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m44.4 35.5 98.7 74.6-17.5-44.3zm193.9 171.3-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" />
    <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m103.6 138.2-15.8 23.9 56.3 2.5-2-60.5zm111.3 0-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5 33.9 16.5-4.7-39.3z" />
    <path fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" d="m211.8 247.4-33.9-16.5 2.7 22.1-.3 9.3zm-105 0 31.5 14.9-.2-9.3 2.5-22.1z" />
    <path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="m138.8 193.5-28.2-8.3 19.9-9.1zm40.9 0 8.3-17.4 20 9.1z" />
    <path fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" d="m106.8 247.4 4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7zm23.8-44.7-56.2 2.5 5.2 28.9 8.3-17.4 20 9.1zm-120.2 23.1 20-9.1 8.2 17.4 5.3-28.9-56.3-2.5z" />
    <path fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" d="m87.8 162.1 23.6 46-.8-22.9zm120.3 23.1-1 22.9 23.7-46zm-64-20.6-5.3 28.9 6.6 34.1 1.5-44.9zm30.5 0-2.7 18 1.2 45 6.7-34.1z" />
    <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="m179.8 193.5-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zm-69.2-8.3.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z" />
    <path fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round" d="m180.3 262.3.3-9.3-2.5-2.2h-37.7l-2.3 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z" />
    <path fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" d="m177.9 230.9-4.8-3.3h-27.7l-4.8 3.3-2.5 22.1 2.3-2.2h37.7l2.5 2.2z" />
    <path fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round" d="m278.3 114.2 8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z" />
    <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="m267.2 153.5-52.3-15.3 15.9 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4 3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z" />
  </svg>
);

const CoinbaseIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <rect width="40" height="40" rx="10" fill="#0052FF" fillOpacity="0.1" />
    <circle cx="20" cy="20" r="10" fill="#0052FF" />
    <rect x="16" y="16" width="8" height="8" rx="1.5" fill="white" />
  </svg>
);

const WalletConnectIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <rect width="40" height="40" rx="10" fill="#3B99FC" fillOpacity="0.1" />
    <path d="M14.2 17.3c3.2-3.1 8.4-3.1 11.6 0l.4.4c.2.2.2.4 0 .5l-1.3 1.2c-.1.1-.2.1-.3 0l-.5-.5c-2.2-2.2-5.8-2.2-8.1 0l-.6.5c-.1.1-.2.1-.3 0l-1.3-1.2c-.2-.2-.2-.4 0-.5l.4-.4zm14.3 2.7l1.1 1.1c.2.2.2.4 0 .5l-5.2 5.1c-.2.2-.4.2-.6 0l-3.7-3.6c0-.1-.1-.1-.1 0l-3.7 3.6c-.2.2-.4.2-.6 0l-5.2-5.1c-.2-.2-.2-.4 0-.5l1.1-1.1c.2-.2.4-.2.6 0l3.7 3.6c0 .1.1.1.1 0l3.7-3.6c.2-.2.4-.2.6 0l3.7 3.6c0 .1.1.1.1 0l3.7-3.6c.2-.2.5-.2.6 0z" fill="#3B99FC" />
  </svg>
);

const RainbowIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <rect width="40" height="40" rx="10" fill="url(#rg)" fillOpacity="0.12" />
    <defs><linearGradient id="rg" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#FF494A" /><stop offset="0.3" stopColor="#FF7849" /><stop offset="0.5" stopColor="#FFCE3E" /><stop offset="0.7" stopColor="#48DD82" /><stop offset="1" stopColor="#5B63ED" /></linearGradient></defs>
    <path d="M12 26v-2.5a8 8 0 018-8h0a8 8 0 018 8V26" stroke="url(#rg)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M15.5 26v-2.5a4.5 4.5 0 014.5-4.5h0a4.5 4.5 0 014.5 4.5V26" stroke="url(#rg)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <circle cx="20" cy="25.5" r="1.8" fill="url(#rg)" />
  </svg>
);

const UniswapIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <rect width="40" height="40" rx="10" fill="#FF007A" fillOpacity="0.1" />
    <path d="M17.2 12.8c-.3 0-.4-.1-.4-.2 0-.2.3-.3.7-.2 1.7.3 2.5 1.3 3 2.2.5.9.7 1.8.7 2.2 0 .3-.1.5-.1.8 0 .1-.1.3-.1.5 0 .5.2.8.5 1 .2.2.5.3.7.3.1 0 .2 0 .3-.1.2-.1.3-.2.3-.3 0-.1-.1-.2-.2-.3-.2-.1-.4-.2-.4-.5 0-.2.1-.4.3-.5.3-.2.6-.1.8.1.2.3.2.7 0 1-.3.5-.8.8-1.3.7-.6 0-1.1-.3-1.4-.7-.3-.4-.4-.9-.4-1.4l.1-.7c0-.3.1-.5 0-.7-.1-.8-.3-1.6-.8-2.3-.4-.5-.9-1-1.4-1.1-.3-.1-.5-.1-.6-.2-.1 0-.2-.1-.2-.2z" fill="#FF007A" />
    <path d="M23.4 14.2c.1.3.1.5 0 .8-.2.8-.8 1.3-1.4 1.8l-.4.4c-.4.4-.6.9-.5 1.4.1.4.3.7.6.9l.2.1c.8.5 1 1.4.7 2.1-.2.4-.5.7-.9.9-.1 0-.1.1-.1.2.1.8-.1 1.6-.5 2.2-.6.9-1.5 1.4-2.5 1.6-1 .2-2 .1-2.9-.2-1.2-.4-2.2-1.2-2.9-2.3-.5-.7-.8-1.6-.9-2.4-.1-.4 0-.8.1-1.2.1-.3.3-.6.5-.8.3-.3.6-.4 1-.5.3 0 .5 0 .8.1.2.1.3.3.4.5s0 .4-.1.6c-.1.2-.3.3-.5.3s-.4 0-.5-.2c-.1-.1-.2-.2-.2-.1-.3.2-.4.6-.3 1 .1 1 .6 1.9 1.4 2.5.6.5 1.3.7 2.1.7.6 0 1.2-.2 1.6-.6.4-.3.7-.8.8-1.3v-.4c-.4.1-.8.1-1.2 0-.5-.2-.9-.6-1.1-1.1-.2-.6-.1-1.2.2-1.7.2-.3.5-.5.8-.6.3-.1.7-.1 1 0 .3.1.4.3.5.5 0-.6.2-1.1.5-1.6.4-.6 1-1.1 1.7-1.3.5-.2 1-.2 1.5-.1z" fill="#FF007A" />
  </svg>
);

const walletIcons: Record<string, React.FC> = {
  metamask: MetaMaskIcon,
  coinbase: CoinbaseIcon,
  walletconnect: WalletConnectIcon,
  rainbow: RainbowIcon,
  uniswap: UniswapIcon,
};

const wallets = [
  { id: 'metamask', name: 'MetaMask', description: 'Browser extension & mobile', tag: 'Popular' },
  { id: 'coinbase', name: 'Coinbase Wallet', description: 'Self-custody wallet by Coinbase' },
  { id: 'walletconnect', name: 'WalletConnect', description: 'Scan QR from any mobile wallet' },
  { id: 'rainbow', name: 'Rainbow', description: 'Mobile-first Ethereum wallet' },
  { id: 'uniswap', name: 'Morphex Wallet', description: 'Built for DeFi traders' },
];

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  onConnectSuccess,
  connectedWallet,
}) => {
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  if (!isOpen) return null;

  const shortAddr = connectedWallet
    ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
    : null;

  const handleConnect = async (walletName: string) => {
    setConnectingWallet(walletName);
    try {
      const { address } = await connectWallet();
      onConnectSuccess(address);
      onClose();
    } catch {
      onConnectSuccess('');
    } finally {
      setConnectingWallet(null);
    }
  };

  const handleDisconnect = () => {
    onConnectSuccess('');
    onClose();
  };

  return (
    <div
      id="wallet-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.18s ease-out' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        id="wallet-modal"
        className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f1318] to-[#161b22] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.25s cubic-bezier(.16,1,.3,1)' }}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full bg-[#00E5FF]/8 blur-3xl" />

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Connect Wallet</h2>
            <p className="text-xs text-white/40 mt-0.5">Morphex · Sepolia Testnet</p>
          </div>
          <button
            id="close-wallet-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected banner */}
        {connectedWallet && (
          <div className="mx-6 mb-3 flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-semibold text-emerald-300">Connected</span>
                <p className="text-[11px] text-emerald-300/60 font-mono mt-0.5">{shortAddr}</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all"
            >
              <LogOut className="w-3 h-3" />
              Disconnect
            </button>
          </div>
        )}

        {/* Wallet list */}
        <div className="px-6 pb-2 space-y-1.5">
          {wallets.map((w) => {
            const Icon = walletIcons[w.id];
            const isConnecting = connectingWallet === w.name;
            const isConnected = connectedWallet !== null && connectingWallet === null;

            return (
              <button
                key={w.id}
                id={`wallet-option-${w.id}`}
                onClick={() => void handleConnect(w.name)}
                disabled={isConnecting}
                className="group w-full flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.12] p-3.5 transition-all duration-200 text-left disabled:opacity-60"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white/5 ring-1 ring-white/[0.06]">
                    <Icon />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13px] text-white/90 group-hover:text-white transition-colors">
                        {w.name}
                      </span>
                      {w.tag && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#00E5FF] bg-[#00E5FF]/10 px-1.5 py-0.5 rounded-md">
                          {w.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5">{w.description}</p>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all duration-200" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pt-3 pb-5 flex items-center justify-center gap-1.5 border-t border-white/[0.06]">
          <ShieldCheck className="w-3 h-3 text-white/20" />
          <span className="text-[11px] text-white/25">
            Secured by Morphex · Your keys, your crypto
          </span>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
};

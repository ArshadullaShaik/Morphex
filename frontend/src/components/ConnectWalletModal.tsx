import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Loader2,
  ArrowRight,
  LogOut,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
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
    <path
      d="M14.2 17.3c3.2-3.1 8.4-3.1 11.6 0l.4.4c.2.2.2.4 0 .5l-1.3 1.2c-.1.1-.2.1-.3 0l-.5-.5c-2.2-2.2-5.8-2.2-8.1 0l-.6.5c-.1.1-.2.1-.3 0l-1.3-1.2c-.2-.2-.2-.4 0-.5l.4-.4zm14.3 2.7l1.1 1.1c.2.2.2.4 0 .5l-5.2 5.1c-.2.2-.4.2-.6 0l-3.7-3.6c0-.1-.1-.1-.1 0l-3.7 3.6c-.2.2-.4.2-.6 0l-5.2-5.1c-.2-.2-.2-.4 0-.5l1.1-1.1c.2-.2.4-.2.6 0l3.7 3.6c0 .1.1.1.1 0l3.7-3.6c.2-.2.4-.2.6 0l3.7 3.6c0 .1.1.1.1 0l3.7-3.6c.2-.2.5-.2.6 0z"
      fill="#3B99FC"
    />
  </svg>
);

const InjectedBrowserIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <rect width="40" height="40" rx="10" fill="#7342E2" fillOpacity="0.12" />
    <path
      d="M20 10L28 15V25L20 30L12 25V15L20 10Z"
      stroke="#7342E2"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="20" cy="20" r="4" fill="#7342E2" />
  </svg>
);

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  onConnectSuccess,
  connectedWallet,
}) => {
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [hasInjectedWallet, setHasInjectedWallet] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  useEffect(() => {
    setHasInjectedWallet(typeof window !== 'undefined' && Boolean(window.ethereum));
  }, []);

  if (!isOpen) return null;

  const shortAddr = connectedWallet
    ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
    : null;

  const handleConnect = async (walletName: string) => {
    setConnectingWallet(walletName);
    setConnectError(null);
    try {
      if (!window.ethereum) {
        throw new Error('No Ethereum wallet detected. Please install MetaMask to continue.');
      }
      const { address } = await connectWallet();
      onConnectSuccess(address);
      onClose();
    } catch (err) {
      console.error('Wallet connect error:', err);
      setConnectError(err instanceof Error ? err.message : 'Could not connect wallet.');
    } finally {
      setConnectingWallet(null);
    }
  };

  const handleDisconnect = () => {
    onConnectSuccess('');
    onClose();
  };

  const handleCopy = () => {
    if (!connectedWallet) return;
    navigator.clipboard.writeText(connectedWallet);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const wallets = [
    {
      id: 'metamask',
      name: 'MetaMask',
      description: 'Browser extension & mobile app',
      icon: MetaMaskIcon,
      isDetected: hasInjectedWallet,
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      description: 'Self-custody wallet by Coinbase',
      icon: CoinbaseIcon,
      isDetected: false,
    },
    {
      id: 'injected',
      name: 'Browser Injected (EIP-1193)',
      description: 'Default browser provider (window.ethereum)',
      icon: InjectedBrowserIcon,
      isDetected: hasInjectedWallet,
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      description: 'Scan QR from mobile wallet',
      icon: WalletConnectIcon,
      isDetected: false,
    },
  ];

  return (
    <div
      id="wallet-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Modal */}
      <div
        id="wallet-modal"
        className="relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/80 bg-white/95 backdrop-blur-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-extrabold text-[#192837] tracking-tight">Connect a Wallet</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Sepolia Testnet · Zama FHEVM Enabled</p>
          </div>
          <button
            id="close-wallet-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#4B5563] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected state card */}
        {connectedWallet && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#047857]">Connected Account</span>
                <p className="text-xs font-mono font-bold text-[#192837] mt-0.5">{shortAddr}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-white border border-[#A7F3D0] text-[#047857] hover:bg-emerald-50 text-xs font-semibold flex items-center gap-1"
                title="Copy Address"
              >
                {copiedAddr ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1 text-xs font-bold text-[#DC2626] bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}

        {/* Missing Wallet Warning Banner */}
        {!hasInjectedWallet && (
          <div className="mt-4 p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] text-xs text-[#9A3412] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">No Web3 Wallet Detected</span>
              <span>
                To use Morphex, please install MetaMask or a compatible browser wallet.{' '}
              </span>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[#C2410C] underline inline-flex items-center gap-1 mt-1"
              >
                Download MetaMask <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {connectError && (
          <div className="mt-4 p-3 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs font-semibold text-[#B91C1C]">
            {connectError}
          </div>
        )}

        {/* Wallet Options List */}
        <div className="mt-4 space-y-2">
          {wallets.map((w) => {
            const Icon = w.icon;
            const isConnecting = connectingWallet === w.name;

            return (
              <button
                key={w.id}
                id={`wallet-option-${w.id}`}
                onClick={() => void handleConnect(w.name)}
                disabled={isConnecting}
                className="group w-full flex items-center justify-between rounded-2xl border border-gray-200/80 bg-white hover:border-[#7342E2]/50 hover:bg-[#7342E2]/5 p-3.5 transition-all duration-200 text-left cursor-pointer shadow-xs disabled:opacity-60"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center border border-gray-100">
                    <Icon />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#192837] group-hover:text-[#7342E2] transition-colors">
                        {w.name}
                      </span>
                      {w.isDetected && (
                        <span className="text-[10px] font-bold text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-full">
                          Detected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">{w.description}</p>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 text-[#7342E2] animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#7342E2] group-hover:translate-x-0.5 transition-all duration-200" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
          <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          <span>Strictly real Web3 · Zero simulated accounts</span>
        </div>
      </div>
    </div>
  );
};

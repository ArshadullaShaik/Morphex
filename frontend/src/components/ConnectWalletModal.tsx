import React, { useState } from 'react';
import { X, CheckCircle2, Loader2, Shield, ArrowRight, ExternalLink } from 'lucide-react';
import { connectWallet } from '../morphex';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSuccess: (walletName: string) => void;
  connectedWallet: string | null;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  onConnectSuccess,
  connectedWallet,
}) => {
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  if (!isOpen) return null;

  const wallets = [
    {
      id: 'metamask',
      name: 'MetaMask',
      description: 'Popular Ethereum browser extension',
      iconText: '🦊',
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      description: 'Self-custody mobile and browser wallet',
      iconText: '🔵',
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      description: 'Scan QR with your mobile crypto app',
      iconText: '⚡',
    },
    {
      id: 'rainbow',
      name: 'Rainbow',
      description: 'Ethereum & L2 mobile-first wallet',
      iconText: '🌈',
    },
    {
      id: 'uniswap',
      name: 'Uniswap Wallet',
      description: 'Built for decentralized trading',
      iconText: '🦄',
    },
  ];

  const handleConnect = async (walletName: string) => {
    setConnectingWallet(walletName);
    try {
      const { address } = await connectWallet();
      onConnectSuccess(address);
      onClose();
    } catch (error) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        id="wallet-modal"
        className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E5E7EB] p-6 overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-base font-bold text-[#0D111C]">Connect a wallet</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Connect to Morphex on Sepolia testnet</p>
          </div>
          <button
            id="close-wallet-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#0D111C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status if connected */}
        {connectedWallet && (
          <div className="mt-4 p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-semibold text-[#065F46]">Connected to {connectedWallet}</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs font-bold text-[#DC2626] hover:underline"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Wallets List */}
        <div className="mt-4 space-y-2">
          {wallets.map((w) => {
            const isConnecting = connectingWallet === w.name;
            const isConnected = connectedWallet === w.name;

            return (
              <button
                key={w.id}
                id={`wallet-option-${w.id}`}
                onClick={() => handleConnect(w.name)}
                disabled={isConnecting}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                  isConnected
                    ? 'border-[#00E5FF] bg-[#ECFEFF]'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-lg shrink-0">
                    {w.iconText}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[#0D111C]">{w.name}</div>
                    <div className="text-[11px] text-[#6B7280]">{w.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 text-[#0E7490] animate-spin" />
                  ) : isConnected ? (
                    <span className="text-[11px] font-bold text-[#0E7490] bg-[#00E5FF]/20 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <ArrowRight className="w-4 h-4 text-[#9CA3AF]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-center text-[11px] text-[#6B7280]">
          <span>By connecting a wallet, you agree to Uniswap's Terms of Service and Privacy Policy.</span>
        </div>
      </div>
    </div>
  );
};

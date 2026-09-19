import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, ShieldCheck, Cpu, Lock, BookOpen, Layers } from 'lucide-react';
import { config } from '../morphex';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedAddress(key);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const contracts = [
    { name: 'Morphex Factory', address: config.factoryAddress || '0x6a54F96C186088e5b66d4825d198305c6E04F98E' },
    { name: 'Confidential Pair (MORPH/mUSD)', address: config.pairAddress || '0x72c84eCfba7DB1DC1D7fA1Bf12D4343f455BC939' },
    { name: 'Morphex Token (MORPH)', address: config.token0Address || '0x60f00ea035D8350BF6E3d98a148dCeBeCDa9d0B0' },
    { name: 'Morphex USD (mUSD)', address: config.token1Address || '0x242064EA104a0cC49426dAcF0689E95774ed249B' },
    { name: 'Relayer Vault', address: config.vaultAddress || '0x5FbDB2315678afecb367f032d93F642f64180aa3' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md animate-in fade-in" />

      {/* Modal Container */}
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/70 shadow-2xl flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7342E2]/10 flex items-center justify-center text-[#7342E2]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#192837]">Morphex Protocol Documentation</h2>
              <p className="text-xs text-[#6B7280]">Zama FHEVM · Confidential AMM Architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-[#192837] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#4B5563] leading-relaxed">
          {/* Section 1: Architecture Overview */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#192837]">
              <Cpu className="w-4 h-4 text-[#7342E2]" />
              <h3>1. Fully Homomorphic Encryption (FHEVM)</h3>
            </div>
            <p>
              Morphex is built on top of <strong>Zama FHEVM</strong>, bringing privacy-preserving computation directly into the Ethereum Virtual Machine. Traditional smart contracts require all states (balances, amounts, allowances) to be public. FHE allows the Morphex AMM pair to verify math equations (e.g. constant product $x \cdot y = k$) on <strong>encrypted ciphertexts</strong> without ever decrypting the numbers on-chain.
            </p>
          </section>

          {/* Section 2: How Encrypted Swaps Work */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#192837]">
              <Lock className="w-4 h-4 text-[#7342E2]" />
              <h3>2. Confidential Swap Lifecycle</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <span className="font-bold text-[#192837] block mb-1">1. Client Encryption</span>
                <p className="text-[11px] text-[#6B7280]">
                  Your browser encrypts trade amounts into <code>euint64</code> using Zama's WASM SDK and the network public key.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <span className="font-bold text-[#192837] block mb-1">2. Invariant Math</span>
                <p className="text-[11px] text-[#6B7280]">
                  The smart contract executes <code>fhe.mul</code>, <code>fhe.sub</code>, and <code>fhe.ge</code> to verify reserves without exposing trade size.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <span className="font-bold text-[#192837] block mb-1">3. Relayer Decrypt</span>
                <p className="text-[11px] text-[#6B7280]">
                  Only the user holding the authorized private key can decrypt their personal balances via EIP-712 signatures.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Smart Contract Deployments */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#192837]">
              <Layers className="w-4 h-4 text-[#7342E2]" />
              <h3>3. Sepolia Testnet Contracts</h3>
            </div>
            <div className="space-y-2">
              {contracts.map((contract) => (
                <div
                  key={contract.name}
                  className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#192837]">{contract.name}</div>
                    <div className="font-mono text-[11px] text-[#64748B] truncate">
                      {contract.address}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(contract.name, contract.address)}
                      className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-gray-50 text-[#4B5563] transition-colors"
                      title="Copy Address"
                    >
                      {copiedAddress === contract.name ? (
                        <Check className="w-3.5 h-3.5 text-[#10B981]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`https://sepolia.etherscan.io/address/${contract.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-gray-50 text-[#4B5563] transition-colors"
                      title="View on Etherscan"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Security & Trust Assumptions */}
          <section className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-xs text-[#047857] mb-0.5">Trustless Cryptography</span>
              <p className="text-[11px] leading-relaxed">
                All confidential logic runs on the Zama Threshold KMS and decentralized FHE coprocessor network. No central operator or MEV bot can decipher transactions in flight or manipulate slippage.
              </p>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#6B7280]">
          <span>Network: Ethereum Sepolia (Chain ID: 11155111)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#7342E2] hover:bg-[#6533D6] text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

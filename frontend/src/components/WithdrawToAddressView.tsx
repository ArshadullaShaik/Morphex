import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Contract, getAddress, isAddress, parseUnits } from 'ethers';
import {
  ArrowUpRight,
  Camera,
  ClipboardPaste,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  SwitchCamera,
  User,
  X,
} from 'lucide-react';
import {
  connectWallet,
  deployedTokens,
  fetchWithdrawalRequest,
  claimEscapedWithdrawal,
  submitConfidentialRedemptionTo,
} from '../morphex';
import { TokenIcon } from './TokenIcon';

const decimalsAbi = ['function decimals() view returns (uint8)'];

/** Parses raw QR text — supports plain 0x address and EIP-681 `ethereum:0x...` URI */
function parseQrAddress(raw: string): string | null {
  const trimmed = raw.trim();
  // EIP-681: ethereum:0xabc...?params
  const eip681Match = /^ethereum:(0x[0-9a-fA-F]{40})/i.exec(trimmed);
  if (eip681Match) {
    const addr = eip681Match[1];
    if (isAddress(addr)) return getAddress(addr);
  }
  // Plain address
  if (isAddress(trimmed)) return getAddress(trimmed);
  return null;
}

/* ------------------------------------------------------------------ */
/*  QR Scanner overlay using html5-qrcode                             */
/* ------------------------------------------------------------------ */
const QrScannerOverlay: React.FC<{
  onScan: (address: string) => void;
  onClose: () => void;
}> = ({ onScan, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [switching, setSwitching] = useState(false);

  const startCamera = useCallback(
    async (facingMode: 'environment' | 'user') => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!containerRef.current) return;

        // Stop any existing scanner first
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch {
            /* already stopped */
          }
        }

        const scanner = new Html5Qrcode(containerRef.current.id);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText: string) => {
            const address = parseQrAddress(decodedText);
            if (address) {
              scanner.stop().catch(() => {});
              onScan(address);
            }
          },
          () => {
            /* ignore non-QR frames */
          },
        );
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message.includes('NotAllowed')
              ? 'Camera permission denied. Please allow camera access and try again.'
              : err.message
            : 'Could not start camera.',
        );
      }
    },
    [onScan],
  );

  useEffect(() => {
    let mounted = true;
    if (mounted) void startCamera(facing);
    return () => {
      mounted = false;
      scannerRef.current?.stop?.().catch(() => {});
    };
    // Only run on mount/unmount — camera switches are handled by flipCamera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipCamera = async () => {
    setSwitching(true);
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startCamera(next);
    setSwitching(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4 rounded-2xl bg-white overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-[#00E5FF]" />
            <span className="text-sm font-bold text-[#0D111C]">Scan Wallet QR Code</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void flipCamera()}
              disabled={switching}
              className="rounded-full p-1.5 hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
              aria-label="Switch camera"
              title={facing === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
            >
              <SwitchCamera className={`h-4.5 w-4.5 text-[#6B7280] ${switching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-[#F3F4F6] transition-colors"
              aria-label="Close scanner"
            >
              <X className="h-5 w-5 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black">
          <div
            id="morphex-qr-reader"
            ref={containerRef}
            className="w-full min-h-[320px]"
          />
          {/* Scanning animation overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[250px] h-[250px] rounded-lg border-2 border-[#00E5FF]/50 relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#00E5FF] rounded-tl-md" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#00E5FF] rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#00E5FF] rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#00E5FF] rounded-br-md" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-center">
          {error ? (
            <p className="text-xs font-semibold text-red-500">{error}</p>
          ) : (
            <p className="text-xs text-[#6B7280]">
              {facing === 'environment' ? 'Back' : 'Front'} camera · Tap
              <button onClick={() => void flipCamera()} disabled={switching} className="mx-1 font-semibold text-[#00BCD4] hover:underline">
                flip
              </button>
              to switch
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main withdraw-to-address view                                      */
/* ------------------------------------------------------------------ */
export const WithdrawToAddressView: React.FC<{
  connectedWallet: string | null;
  onOpenWallet: () => void;
}> = ({ connectedWallet, onOpenWallet }) => {
  const [selectedToken, setSelectedToken] = useState(deployedTokens[0]);
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [requestId, setRequestId] = useState<bigint | null>(null);
  const [request, setRequest] = useState<Awaited<ReturnType<typeof fetchWithdrawalRequest>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /** Validate the address on every change */
  const handleAddressChange = useCallback((value: string) => {
    setRecipientAddress(value);
    if (!value.trim()) {
      setAddressError(null);
      return;
    }
    if (!isAddress(value.trim())) {
      setAddressError('Invalid Ethereum address');
    } else {
      setAddressError(null);
    }
  }, []);

  /** Paste from clipboard */
  const pasteAddress = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseQrAddress(text);
      handleAddressChange(parsed || text);
    } catch {
      setMessage('Could not read clipboard. Please paste manually.');
    }
  };

  /** Fill with connected wallet */
  const useMyWallet = () => {
    if (connectedWallet) {
      handleAddressChange(connectedWallet);
    }
  };

  /** QR scan callback */
  const handleQrScan = useCallback(
    (address: string) => {
      setShowScanner(false);
      handleAddressChange(address);
    },
    [handleAddressChange],
  );

  /** Submit withdrawal */
  const withdraw = async () => {
    if (!connectedWallet) return onOpenWallet();
    if (!selectedToken || !amount || !recipientAddress.trim()) return;

    const normalizedRecipient = recipientAddress.trim();
    if (!isAddress(normalizedRecipient)) {
      setAddressError('Invalid Ethereum address');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const { signer } = await connectWallet();
      const decimals = Number(
        await new Contract(selectedToken.address, decimalsAbi, signer).decimals(),
      );
      const units = parseUnits(amount, decimals);
      if (units <= 0n) throw new Error('Enter an amount greater than zero.');

      const checksumRecipient = getAddress(normalizedRecipient);

      const result = await submitConfidentialRedemptionTo(
        signer,
        connectedWallet,
        checksumRecipient,
        selectedToken.address,
        units,
      );

      setRequestId(result.requestId);
      setRequest(await fetchWithdrawalRequest(result.requestId));
      setAmount('');
      setMessage(
        `Withdrawal request #${result.requestId.toString()} submitted. The relayer will send ${selectedToken.symbol.replace(/^c/, '')} to ${checksumRecipient.slice(0, 6)}...${checksumRecipient.slice(-4)}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Withdrawal failed.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (requestId === null) return;
    setBusy(true);
    try {
      setRequest(await fetchWithdrawalRequest(requestId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read withdrawal status.');
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!connectedWallet || requestId === null) return;
    setBusy(true);
    try {
      const { signer } = await connectWallet();
      await claimEscapedWithdrawal(signer, requestId);
      await refresh();
      setMessage('The escape-hatch claim released the real ERC-20 to the recipient wallet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim failed.');
    } finally {
      setBusy(false);
    }
  };

  const isValidForSubmit =
    !!amount &&
    !!recipientAddress.trim() &&
    isAddress(recipientAddress.trim()) &&
    !addressError;

  return (
    <>
      <section className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0D111C]">Send to external wallet</h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              Burn cUSDC or cUSDT and send the corresponding ERC-20 to any wallet address.
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-[#6B7280]" />
        </div>

        {deployedTokens.length === 0 ? (
          <p className="rounded-xl bg-[#F9FAFB] p-3 text-xs font-semibold text-[#6B7280]">
            No confidential tokens are configured.
          </p>
        ) : (
          <>
            {/* Token selector */}
            <div className="flex items-center gap-3">
              <TokenIcon symbol={selectedToken?.symbol || 'cUSDC'} size="lg" />
              <select
                value={selectedToken?.symbol || ''}
                onChange={(e) =>
                  setSelectedToken(
                    deployedTokens.find((t) => t.symbol === e.target.value) || deployedTokens[0],
                  )
                }
                className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 text-sm font-semibold"
              >
                {deployedTokens.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount input */}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/40"
            />

            {/* Recipient address input */}
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-semibold text-[#374151]">
                Recipient wallet address
              </label>
              <div className="relative">
                <input
                  value={recipientAddress}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="0x..."
                  spellCheck={false}
                  className={`w-full rounded-xl border px-4 py-3 pr-28 font-mono text-sm focus:outline-none focus:ring-2 ${
                    addressError
                      ? 'border-red-400 focus:ring-red-300/40'
                      : 'border-[#E5E7EB] focus:ring-[#00E5FF]/40'
                  }`}
                />
                {/* Action buttons inside input */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={pasteAddress}
                    title="Paste address"
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0D111C] transition-colors"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                  </button>
                  <button
                    onClick={useMyWallet}
                    title="Use my connected wallet"
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0D111C] transition-colors"
                  >
                    <User className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowScanner(true)}
                    title="Scan QR code"
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#00E5FF]/10 hover:text-[#00BCD4] transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {addressError && (
                <p className="mt-1 text-xs font-medium text-red-500">{addressError}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              onClick={() => void withdraw()}
              disabled={busy || !isValidForSubmit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D111C] py-3 text-sm font-bold text-white disabled:opacity-60 hover:bg-[#1a1f2e] transition-colors"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
              Burn &amp; send to wallet
            </button>
          </>
        )}

        {/* Request status */}
        {requestId !== null && request && (
          <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs text-[#374151]">
            <div className="flex items-center justify-between font-semibold">
              <span>Request #{requestId.toString()}</span>
              <button onClick={() => void refresh()} disabled={busy} aria-label="Refresh status">
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {request.recipient && (
              <div className="mt-1 truncate font-mono text-[#6B7280]">
                → {request.recipient}
              </div>
            )}
            <div className="mt-2">
              Status:{' '}
              {request.fulfilled
                ? request.escaped
                  ? 'Claimed by escape hatch'
                  : 'Paid by relayer'
                : 'Awaiting relayer payout'}
            </div>
            {!request.fulfilled && (
              <button
                onClick={() => void claim()}
                disabled={busy}
                className="mt-3 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-semibold disabled:opacity-60 hover:bg-[#F3F4F6] transition-colors"
              >
                Claim after escape delay
              </button>
            )}
          </div>
        )}

        {message && (
          <p className="mt-3 rounded-xl bg-[#F9FAFB] p-3 text-xs font-semibold text-[#374151]">
            {message}
          </p>
        )}
      </section>

      {/* QR Scanner modal */}
      {showScanner && (
        <QrScannerOverlay
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
};

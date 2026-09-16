import React, { useState } from 'react';
import { X, Info, Sliders, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: number;
  onSlippageChange: (val: number) => void;
  autoSlippage: boolean;
  onAutoSlippageToggle: (val: boolean) => void;
  deadline: number;
  onDeadlineChange: (val: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  slippage,
  onSlippageChange,
  autoSlippage,
  onAutoSlippageToggle,
  deadline,
  onDeadlineChange,
}) => {
  const [customSlippage, setCustomSlippage] = useState(slippage.toString());

  if (!isOpen) return null;

  const handleSlippagePreset = (val: number) => {
    onAutoSlippageToggle(false);
    onSlippageChange(val);
    setCustomSlippage(val.toString());
  };

  const handleCustomSlippageChange = (val: string) => {
    setCustomSlippage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 50) {
      onAutoSlippageToggle(false);
      onSlippageChange(num);
    }
  };

  return (
    <div 
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        id="settings-modal"
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl border border-[#E5E7EB] p-5 overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <h2 className="text-base font-bold text-[#0D111C]">Transaction Settings</h2>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#0D111C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slippage tolerance */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-[#0D111C]">Slippage Tolerance</span>
            <span className="text-[#6B7280] font-mono">{autoSlippage ? 'Auto (0.5%)' : `${slippage}%`}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onAutoSlippageToggle(true);
                onSlippageChange(0.5);
                setCustomSlippage('0.5');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                autoSlippage
                  ? 'bg-[#0D111C] text-white'
                  : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
              }`}
            >
              Auto
            </button>

            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                onClick={() => handleSlippagePreset(val)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  !autoSlippage && slippage === val
                    ? 'bg-[#0D111C] text-white'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                }`}
              >
                {val}%
              </button>
            ))}

            <div className="relative flex-1">
              <input
                type="text"
                value={customSlippage}
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                placeholder="Custom"
                className="w-full pl-2 pr-5 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-right text-[#0D111C] focus:outline-none focus:border-[#9CA3AF] font-mono font-semibold"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">%</span>
            </div>
          </div>
        </div>

        {/* Transaction Deadline */}
        <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-[#0D111C]">Transaction Deadline</span>
            <span className="text-[#6B7280] font-mono">{deadline} mins</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="180"
              value={deadline}
              onChange={(e) => onDeadlineChange(parseInt(e.target.value) || 20)}
              className="w-24 px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#0D111C] focus:outline-none focus:border-[#9CA3AF] font-mono font-semibold"
            />
            <span className="text-xs text-[#6B7280]">minutes</span>
          </div>
        </div>

        {/* Smart Routing */}
        <div className="mt-4 pt-4 border-t border-[#F3F4F6] flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-[#0D111C]">Morphex Smart Order Router</div>
            <div className="text-[11px] text-[#6B7280]">Automatically routes across Morphex confidential AMM pools</div>
          </div>
          <span className="text-[11px] font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
      </div>
    </div>
  );
};

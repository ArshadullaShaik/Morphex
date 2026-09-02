import React, { useState } from 'react';
import { Paintbrush, Sparkles, Check, ChevronUp, ChevronDown, Brush } from 'lucide-react';
import { BACKGROUND_ART_PRESETS } from './BackgroundBokeh';

interface BackgroundPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export const BackgroundPicker: React.FC<BackgroundPickerProps> = ({
  selectedId,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const current = BACKGROUND_ART_PRESETS.find((b) => b.id === selectedId) || BACKGROUND_ART_PRESETS[0];

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Expanded Palette Menu */}
      {isOpen && (
        <div 
          id="background-picker-menu"
          className="mb-2 p-3.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#E5E7EB] w-80 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-[#F3F4F6] mb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0D111C]">
              <div className="w-5 h-5 rounded-md bg-[#00E5FF]/20 flex items-center justify-center text-[#0E7490]">
                <Paintbrush className="w-3 h-3" />
              </div>
              <span>Painted Canvas Artwork</span>
            </div>
            <span className="text-[10px] text-[#6B7280] font-medium bg-[#F3F4F6] px-2 py-0.5 rounded-full">
              {BACKGROUND_ART_PRESETS.length} Paintings
            </span>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {BACKGROUND_ART_PRESETS.map((preset) => {
              const isSelected = preset.id === selectedId;
              return (
                <button
                  key={preset.id}
                  onClick={() => onSelect(preset.id)}
                  className={`w-full flex items-start justify-between p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-[#ECFEFF] border border-[#A5F3FC] text-[#0E7490] shadow-sm'
                      : 'hover:bg-[#F9FAFB] border border-transparent text-[#374151]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg bg-cover bg-center border border-[#E5E7EB] shrink-0 shadow-inner overflow-hidden relative"
                      style={{ backgroundImage: `url(${preset.artUrl})` }}
                    >
                      <div className="absolute inset-0 bg-black/10" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0D111C] leading-tight">
                        {preset.name}
                      </div>
                      <div className="text-[10.5px] text-[#0E7490] font-medium mt-0.5">
                        {preset.artistStyle}
                      </div>
                      <div className="text-[9.5px] text-[#6B7280] line-clamp-1 mt-0.5">
                        {preset.category}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-1 w-5 h-5 rounded-full bg-[#00E5FF] flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3 h-3 text-[#0D111C] stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#F3F4F6] flex items-center justify-between text-[11px] text-[#6B7280]">
            <span className="flex items-center gap-1">
              <Brush className="w-3 h-3 text-[#0E7490]" />
              Oil, Gouache & Linen Texture
            </span>
            <span className="text-[10px] font-semibold text-[#0E7490]">
              Fine Art
            </span>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        id="toggle-background-picker-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3.5 py-2 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-[#E5E7EB] hover:bg-white text-[#0D111C] text-xs font-bold transition-all active:scale-95 group"
      >
        <div className="w-5 h-5 rounded-full bg-[#00E5FF] flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform">
          <Paintbrush className="w-3 h-3 text-[#0D111C]" />
        </div>
        <span>Painting: {current.name.split(' ')[0]}</span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-[#6B7280]" />
        )}
      </button>
    </div>
  );
};

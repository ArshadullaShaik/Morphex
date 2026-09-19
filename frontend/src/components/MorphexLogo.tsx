import React from 'react';

export interface MorphexLogoProps {
  variant?: 'full' | 'icon';
  theme?: 'dark' | 'white' | 'purple';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
}

/**
 * Official Morphex Logo Component
 * - Geometric multi-faceted "M" emblem matching the official reference image:
 *   - Shape 1: Left Pillar & Center Diagonal Band (45-degree angle)
 *   - Shape 2: Top-Right Upward Arrow Chevron Motif
 *   - Shape 3: Bottom-Right Square Base Anchor
 * - Clean bold grotesque wordmark "Morphex"
 * - Auto-scaling aspect ratios: ~1.206 for standalone mark, ~5.06 for full logo
 */
export const MorphexLogo: React.FC<MorphexLogoProps> = ({
  variant = 'full',
  theme = 'dark',
  className = '',
  size = 'md',
}) => {
  // Theme color mapping
  const colors = {
    dark: {
      primary: '#111827', // Deep slate/black matching reference
      accent: '#7342E2',
      text: '#111827',
    },
    white: {
      primary: '#FFFFFF',
      accent: '#A78BFA',
      text: '#FFFFFF',
    },
    purple: {
      primary: '#7342E2',
      accent: '#9065F7',
      text: '#7342E2',
    },
  }[theme];

  // Size configurations
  let height = 32;
  if (typeof size === 'number') {
    height = size;
  } else {
    switch (size) {
      case 'sm':
        height = 24;
        break;
      case 'md':
        height = 32;
        break;
      case 'lg':
        height = 40;
        break;
      case 'xl':
        height = 48;
        break;
    }
  }

  // Standalone Icon aspect ratio: 152 / 126 ≈ 1.206
  const iconWidth = Math.round(height * (152 / 126));

  // Geometric "M" Emblem SVG Mark
  const EmblemMark = (
    <svg
      width={iconWidth}
      height={height}
      viewBox="0 0 152 126"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200"
      aria-label="Morphex Emblem"
    >
      {/* Shape 1: Left Pillar & Center Diagonal Band */}
      <path
        d="M0 0H26L114.5 88.5H63.5L38 63V126H0V0Z"
        fill={colors.primary}
      />

      {/* Shape 2: Top-Right Upward Arrow Chevron Motif */}
      <path
        d="M101.5 0H152V51L114.5 88.5V38H63.5L101.5 0Z"
        fill={colors.primary}
      />

      {/* Shape 3: Bottom-Right Square Base Anchor */}
      <path
        d="M114.5 88.5H152V126H114.5V88.5Z"
        fill={colors.primary}
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {EmblemMark}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-[0.34em] select-none ${className}`}
      style={{ height, fontSize: `${height}px` }}
    >
      {EmblemMark}
      <span
        className="font-bold tracking-tight leading-none"
        style={{
          color: colors.text,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', 'Segoe UI', sans-serif",
          letterSpacing: '-0.035em',
          fontSize: `${Math.round(height * 0.78)}px`,
          fontWeight: 700,
        }}
      >
        Morphex
      </span>
    </div>
  );
};


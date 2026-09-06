import React from 'react';

interface TokenIconProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const TokenIcon: React.FC<TokenIconProps> = ({ symbol, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-9 h-9 text-base',
    xl: 'w-11 h-11 text-lg',
  };

  const dim = {
    sm: 20,
    md: 28,
    lg: 36,
    xl: 44,
  }[size];

  switch (symbol.toUpperCase()) {
    case 'ETH':
      return (
        <div className={`rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <svg width={dim * 0.6} height={dim * 0.6} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M127.961 0L125.166 9.5V285.169L127.961 287.959L255.923 212.32L127.961 0Z" fill="#E5E7EB" fillOpacity="0.9" />
            <path d="M127.962 0L0 212.32L127.962 287.959V154.159V0Z" fill="#F9FAFB" />
            <path d="M127.961 312.187L126.386 314.107V412.305L127.961 416.907L256 236.587L127.961 312.187Z" fill="#E5E7EB" fillOpacity="0.9" />
            <path d="M127.962 416.907V312.187L0 236.587L127.962 416.907Z" fill="#F9FAFB" />
            <path d="M127.961 287.958L255.923 212.32L127.961 154.158V287.958Z" fill="#9CA3AF" />
            <path d="M0 212.32L127.962 287.958V154.158L0 212.32Z" fill="#D1D5DB" />
          </svg>
        </div>
      );

    case 'USDC':
      return (
        <div className={`rounded-full bg-[#2775CA] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-mono tracking-tighter" style={{ fontSize: dim * 0.45 }}>$</span>
        </div>
      );

    case 'USDT':
      return (
        <div className={`rounded-full bg-[#009393] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-mono tracking-tight font-extrabold" style={{ fontSize: dim * 0.45 }}>₮</span>
        </div>
      );

    case 'WBTC':
      return (
        <div className={`rounded-full bg-[#F7931A] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-serif font-extrabold" style={{ fontSize: dim * 0.45 }}>₿</span>
        </div>
      );

    case 'DAI':
      return (
        <div className={`rounded-full bg-[#F5AC37] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-sans font-bold" style={{ fontSize: dim * 0.45 }}>◈</span>
        </div>
      );

    case 'ARB':
      return (
        <div className={`rounded-full bg-[#28A0F0] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-sans font-extrabold" style={{ fontSize: dim * 0.4 }}>▲</span>
        </div>
      );

    case 'OP':
      return (
        <div className={`rounded-full bg-[#FF0420] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-bold text-xs tracking-tighter">OP</span>
        </div>
      );

    case 'LINK':
      return (
        <div className={`rounded-full bg-[#375BD2] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-sans text-xs">⬡</span>
        </div>
      );

    case 'UNI':
      return (
        <div className={`rounded-full bg-[#00E5FF] flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-slate-900 font-extrabold text-xs">✦</span>
        </div>
      );

    case 'SOL':
      return (
        <div className={`rounded-full bg-[#14F195] flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-slate-950 font-bold text-xs">◎</span>
        </div>
      );

    case 'MORPH':
      return (
        <div className={`rounded-full bg-gradient-to-tr from-[#00E5FF] to-[#0E7490] flex items-center justify-center text-[#0D111C] font-extrabold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#0D111C] font-black text-xs">M</span>
        </div>
      );

    case 'MUSD':
      return (
        <div className={`rounded-full bg-[#0E7490] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#00E5FF] font-mono font-bold text-xs">$</span>
        </div>
      );

    case 'POL':
    case 'MATIC':
      return (
        <div className={`rounded-full bg-[#8247E5] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-bold text-xs">POL</span>
        </div>
      );

    case 'MNT':
      return (
        <div className={`rounded-full bg-[#000000] flex items-center justify-center text-[#00A389] font-bold shrink-0 shadow-sm border border-[#00A389]/30 ${sizeClasses[size]} ${className}`}>
          <span className="text-[#00A389] font-bold text-[10px]">MNT</span>
        </div>
      );

    case 'STRK':
      return (
        <div className={`rounded-full bg-[#0C0C4F] flex items-center justify-center text-[#EC796B] font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#EC796B] font-bold text-xs">✦</span>
        </div>
      );

    case 'ZK':
      return (
        <div className={`rounded-full bg-[#1E69FF] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-extrabold text-xs">ZK</span>
        </div>
      );

    case 'BLAST':
      return (
        <div className={`rounded-full bg-[#FCFC03] flex items-center justify-center text-[#000000] font-black shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-black font-black text-xs">⚡</span>
        </div>
      );

    case 'SCROLL':
      return (
        <div className={`rounded-full bg-[#FFF7ED] border border-[#EA580C] flex items-center justify-center text-[#EA580C] font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#EA580C] font-sans text-xs">📜</span>
        </div>
      );

    case 'LINEA':
      return (
        <div className={`rounded-full bg-[#121212] flex items-center justify-center text-[#61DFFF] font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#61DFFF] font-black text-[10px]">LIN</span>
        </div>
      );

    case 'TAIKO':
      return (
        <div className={`rounded-full bg-[#E81899] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-white font-bold text-[10px]">TKO</span>
        </div>
      );

    case 'METIS':
      return (
        <div className={`rounded-full bg-[#00DACC] flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#0D111C] font-black text-xs">M</span>
        </div>
      );

    case 'IMX':
      return (
        <div className={`rounded-full bg-[#0D111C] border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#00E5FF] font-extrabold text-xs">⚔</span>
        </div>
      );

    case 'MODE':
      return (
        <div className={`rounded-full bg-[#DFFE00] flex items-center justify-center text-black font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-black font-bold text-[9px]">MODE</span>
        </div>
      );

    case 'BOBA':
      return (
        <div className={`rounded-full bg-[#CCFF00] flex items-center justify-center text-[#0D111C] font-bold shrink-0 shadow-sm ${sizeClasses[size]} ${className}`}>
          <span className="text-[#0D111C] font-black text-[9px]">BOBA</span>
        </div>
      );

    default:
      return (
        <div className={`rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold shrink-0 ${sizeClasses[size]} ${className}`}>
          {symbol.slice(0, 2).toUpperCase()}
        </div>
      );
  }
};

import React from 'react';

interface CoinIconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

export function CoinIcon({ className = "w-4 h-4", animated = false }: CoinIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animated ? 'animate-bounce' : ''} shrink-0 inline-block align-middle select-none`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="coinGleam" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="35%" stopColor="#FBBF24" />
          <stop offset="70%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </radialGradient>
        <linearGradient id="coinRimGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>

      {/* Moeda Externa com Borda Dourada */}
      <circle cx="12" cy="12" r="10" fill="url(#coinGleam)" stroke="url(#coinRimGrad)" strokeWidth="1.2" />

      {/* Anel Interno */}
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#FEF08A" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.9" />

      {/* Símbolo Central Florescer / Estrela Dourada */}
      <path
        d="M12 6.5V17.5M6.5 12H17.5M8 8L16 16M16 8L8 16"
        stroke="#78350F"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="12" cy="12" r="2.2" fill="#FEF08A" stroke="#92400E" strokeWidth="0.8" />
    </svg>
  );
}

'use client';

import { useState } from 'react';

interface CategoryPillProps {
  category: { id: string; name: string; slug: string; is_active: boolean };
  isActive: boolean;
  onClick: () => void;
}

export function CategoryPill({ category, isActive, onClick }: CategoryPillProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative px-5 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all duration-200 ${
        isActive
          ? 'bg-[#d4af37] text-[#0a0a0a] shadow-[0_0_15px_rgba(212,175,55,0.4)] border border-[#d4af37]'
          : 'bg-[#1a1a1a] text-white/60 border border-white/10 hover:bg-[#222] hover:text-white hover:border-white/30'
      }`}
    >
      {category.name}
    </button>
  );
}

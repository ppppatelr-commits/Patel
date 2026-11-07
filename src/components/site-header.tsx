'use client';

import Link from 'next/link';
import { useState } from 'react';

interface SiteHeaderProps {
  name: string;
  phones: string[];
}

export function SiteHeader({ name, phones }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#080808] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group min-w-0">
          <img
            src="/patel-logo-gold.png"
            alt="Patel Restaurant Logo"
            className="h-10 sm:h-12 w-auto object-contain flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
          />
          </Link>

        <div className="hidden md:flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-white flex-shrink-0">
          {phones.map((phone, index) => (
            <a
              key={`${phone}-${index}`}
              href={`tel:${phone.replace(/[^\d+]/g, '')}`}
              className="hover:text-[#e6c850] transition-colors flex items-center gap-1"
            >
              <span className="text-[#d4af37]">📞</span>
              <span className="text-[#d4af37]">{phone}</span>
            </a>
          ))}
        </div>

        {phones.length > 0 && (
          <button
            type="button"
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors text-sm font-semibold"
            onClick={() => setOpen((v) => !v)}
            aria-label="Call"
            aria-expanded={open}
          >
            <span className="text-[#d4af37]">📞</span>
            <span>Call</span>
          </button>
        )}
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-[#080808] px-4 py-4 space-y-3">
          {phones.map((phone, index) => (
            <a
              key={`${phone}-${index}`}
              href={`tel:${phone.replace(/[^\d+]/g, '')}`}
              className="block text-[#d4af37] font-semibold hover:text-[#e6c850] transition-colors"
            >
              <span className="text-[#d4af37]">📞</span> {phone}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
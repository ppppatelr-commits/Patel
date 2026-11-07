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

        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-white flex-shrink-0">
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

        <button
          type="button"
          className="md:hidden w-10 h-10 grid place-items-center rounded-lg border border-white/10 bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
              <>
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </>
            ) : (
              <>
                <path d="M3 12h18" />
                <path d="M3 6h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
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
'use client';

import Link from 'next/link';

interface FooterLinkProps {
  number: string;
  className?: string;
}

export function PhoneLink({ number, className }: FooterLinkProps) {
  return (
    <a href={`tel:${number.replace(/\s/g, '')}`} className={`flex items-center gap-1 ${className ?? ''}`}>
      <span className="text-[#d4af37]">📞</span>
      <span>{number}</span>
    </a>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Patel Restaurant Logo"
      className={`object-contain ${className ?? 'h-10 w-auto'}`}
    />
  );
}

export function DeveloperCredit({ phone, name }: { phone: string; name: string }) {
  return (
    <a
      href={`tel:${phone.replace(/\s/g, '')}`}
      className="flex items-center gap-1 text-[#d4af37] underline decoration-[#d4af37]/40 hover:text-[#e6c850] hover:decoration-[#e6c850] transition-all font-semibold text-sm"
    >
      <span>👨‍💻</span>
      <span>Developed by {name}</span>
    </a>
  );
}

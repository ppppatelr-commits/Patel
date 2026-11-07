import Link from "next/link";

interface SiteFooterProps {
  name: string;
  phones: string[];
  address?: string | null;
  developerName: string;
  developerPhone: string;
}

export function SiteFooter({ name, phones, address, developerName, developerPhone }: SiteFooterProps) {
  return (
    <footer className="bg-[#0a0a0a] border-t border-[#d4af37]/30 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src="/patel-logo-gold.png"
            alt="Patel Restaurant Logo"
            className="h-10 sm:h-12 w-auto object-contain flex-shrink-0"
          />
          <span className="font-bold text-sm sm:text-lg uppercase tracking-tight truncate text-[#d4af37]">
            {name}
          </span>
        </div>
        <a
          href={`tel:${developerPhone.replace(/\s/g, '')}`}
          className="text-[#d4af37] hover:text-[#e6c850] transition-colors font-semibold text-xs sm:text-sm flex-shrink-0"
        >
          Developed by {developerName}
        </a>
      </div>
    </footer>
  );
}
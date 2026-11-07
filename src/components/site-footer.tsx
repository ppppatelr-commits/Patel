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
    <footer className="bg-[#0a0a0a] border-t border-[#d4af37]/30 pt-10 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/patel-logo-gold.png"
            alt="Patel Restaurant Logo"
            className="h-14 sm:h-16 w-auto object-contain"
          />
        </div>
        <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#a1a1aa]">
          <span>© 2026 {name}. All Rights Reserved.</span>
          <a
            href={`tel:${developerPhone.replace(/\s/g, '')}`}
            className="hover:text-[#d4af37] transition-colors"
          >
            Developed by {developerName}
          </a>
        </div>
      </div>
    </footer>
  );
}
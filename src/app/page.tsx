import Link from 'next/link';
import { getPublicMenu } from '@/lib/public-menu';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const { settings } = await getPublicMenu();
  const logo = settings.logo_url || '/logo.png';
  const name = settings.name || 'Patel Restaurant';
  const tagline =
    settings.tagline === undefined || settings.tagline === null
      ? 'Premium Authentic Indian Cuisine'
      : settings.tagline;
  // Keep the "(SINCE 1950)" part on its own line on every screen size.
  const sinceMatch = tagline.match(/^(.*?)\s*\(?\s*(SINCE\s+\d{4})\s*\)?\s*$/i);
  const taglineMain = sinceMatch && sinceMatch[1].trim() ? sinceMatch[1].trim() : tagline;
  const taglineSince = sinceMatch && sinceMatch[1].trim() ? sinceMatch[2] : '';
  const phones = [settings.phone_1, settings.phone_2].filter(
    (phone) => phone && phone.trim()
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 group min-w-0">
            <img src={logo} alt="Patel Restaurant" className="h-10 sm:h-12 w-auto object-contain group-hover:rotate-12 transition-transform duration-300 flex-shrink-0" />
            <span className="text-sm sm:text-xl font-bold tracking-tight uppercase truncate">{name}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-secondary flex-shrink-0">
            {phones.map((phone, index) => (
              <a
                key={`${phone}-${index}`}
                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <span className="text-[#d4af37]">📞</span>
                <span className="hidden sm:inline">{phone}</span>
                <span className="sm:hidden">Call</span>
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative py-20 sm:py-32 text-center overflow-hidden flex-1 flex items-center justify-center">
        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6">
          <img
            src={logo}
            alt="Logo"
            className="mx-auto h-52 sm:h-64 md:h-72 w-auto max-w-full object-contain mb-8 opacity-95"
            style={{ filter: 'drop-shadow(0 0 24px rgba(212,175,55,0.3))' }}
          />
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter mb-4 text-[#d4af37] leading-tight">
            {name}
          </h1>
          {tagline && tagline.trim() && (
            <p className="text-lg sm:text-2xl md:text-3xl text-[#d4af37] font-semibold uppercase tracking-wider mb-10">
              <span className="block">{taglineMain}</span>
              {taglineSince && (
                <span className="block whitespace-nowrap">({taglineSince})</span>
              )}
            </p>
          )}
          <div className="flex items-center justify-center">
            <Link
              href="/menu"
              className="inline-flex items-center gap-3 bg-[#d4af37] text-[#0a0a0a] font-black px-10 sm:px-14 py-4 sm:py-5 rounded-2xl text-lg sm:text-2xl uppercase tracking-wider hover:bg-[#e6c850] transition-all transform hover:scale-105 shadow-[0_0_40px_rgba(212,175,55,0.7)] border-2 border-[#d4af37]/40"
            >
              Explore Menu <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#0a0a0a] pt-8 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={logo} alt="Patel Restaurant Logo" className="h-10 sm:h-12 w-auto object-contain flex-shrink-0" />
            <span className="font-bold text-sm sm:text-lg uppercase tracking-tight truncate text-[#d4af37]">{name}</span>
          </div>
          <a
            href="tel:+917303321019"
            className="flex items-center gap-1 text-[#d4af37] underline decoration-[#d4af37]/40 hover:text-[#e6c850] hover:decoration-[#e6c850] transition-all font-semibold text-xs sm:text-sm flex-shrink-0"
          >
            <span>👨‍💻</span>
            <span>Developed by Salman Furniturewala</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

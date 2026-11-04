'use client';

import { useState } from 'react';
import Image from 'next/image';

interface MenuCardProps {
  item: {
    id: string;
    name: string;
    price: number;
    image_url?: string | null;
    image_filename?: string | null;
  };
}

export function MenuCard({ item }: MenuCardProps) {
  const placeholderUrl = `/api/placeholder/${encodeURIComponent(item.name)}`;
  const initialUrl = item.image_url || placeholderUrl;
  const [imgSrc, setImgSrc] = useState(initialUrl);
  const [hasError, setHasError] = useState(false);

  return (
    <article className="group relative bg-[#141414] rounded-2xl border border-white/10 overflow-hidden hover:border-[#d4af37]/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:-translate-y-1">
      <div className="relative aspect-[1/1] overflow-hidden bg-[#0a0a0a]">
        <Image
          src={hasError ? placeholderUrl : imgSrc}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={() => {
            if (!hasError) {
              setHasError(true);
              setImgSrc(placeholderUrl);
            }
          }}
        />

        {/* Price badge */}
        <span className="absolute top-3 right-3 bg-[#d4af37] text-[#0a0a0a] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg border border-[#d4af37] z-10">
          ₹{item.price.toLocaleString('en-IN')}
        </span>

        {/* Subtle dark vignette gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-black/20 pointer-events-none"></div>
      </div>

      <div className="p-5">
        <h3 className="font-bold text-lg tracking-tight text-white leading-snug group-hover:text-[#d4af37] transition-colors">
          {item.name}
        </h3>
      </div>
    </article>
  );
}

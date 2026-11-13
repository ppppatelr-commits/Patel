'use client';

import { useEffect, useState } from 'react';

interface AddressSearchProps {
  onSelect: (label: string, lat: number, lng: number) => void;
}

export default function AddressSearch({ onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query + ' Mumbai')}`
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search address in Mumbai"
        className="w-full px-3 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none text-sm"
      />
      {loading && <p className="text-xs text-secondary mt-1">Searching...</p>}
      {results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-[#141414] border border-white/10 rounded-xl">
          {results.map((r) => (
            <li
              key={r.place_id}
              onClick={() => {
                onSelect(r.display_name, parseFloat(r.lat), parseFloat(r.lon));
                setQuery(r.display_name);
                setResults([]);
              }}
              className="px-3 py-2 text-xs text-white hover:bg-[#1a1a1a] cursor-pointer border-b border-white/5 last:border-0"
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

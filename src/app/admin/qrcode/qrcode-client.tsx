'use client';

import { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface QRCodeClientProps {
  initialName: string;
  initialTagline: string;
}

export default function QRCodeClient({ initialName, initialTagline }: QRCodeClientProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [restaurantName, setRestaurantName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const standRef = useRef<HTMLDivElement>(null);
  const liveUrl = 'https://patel-restaurant.vercel.app';

  // Refresh from the live settings so a change made elsewhere shows up here too.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => {
        if (!s || cancelled) return;
        if (typeof s.name === 'string' && s.name) setRestaurantName(s.name);
        if (typeof s.tagline === 'string') setTagline(s.tagline.trim());
      })
      .catch(() => {
        // Keep the server-provided values.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const qrUrl = tableNumber.trim()
    ? `https://patel-restaurant.vercel.app/?table=${encodeURIComponent(tableNumber.trim())}`
    : liveUrl;

  const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}&margin=10`;

  async function downloadPNG() {
    if (!standRef.current) return;
    try {
      const dataUrl = await toPng(standRef.current, {
        cacheBust: true,
        pixelRatio: 4,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `patel-qr-stand${tableNumber.trim() ? `-table-${tableNumber.trim()}` : ''}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      alert('PNG download failed: ' + (err as Error).message);
    }
  }

  async function downloadPDF() {
    if (!standRef.current) return;
    try {
      const dataUrl = await toPng(standRef.current, {
        cacheBust: true,
        pixelRatio: 4,
        backgroundColor: '#ffffff',
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      // Fit the image centered, preserving aspect ratio
      const imgWidth = 120; // mm
      const imgHeight = 160; // mm (approx stand aspect)
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;
      pdf.addImage(dataUrl, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`patel-qr-stand${tableNumber.trim() ? `-table-${tableNumber.trim()}` : ''}.pdf`);
    } catch (err) {
      alert('PDF download failed: ' + (err as Error).message);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-2">QR Code & Table Stands</h1>
          <p className="text-secondary">Generate, download, and print table QR codes for customer digital menu access</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={downloadPNG}
            className="px-5 py-2.5 bg-[#d4af37] text-[#0a0a0a] font-bold rounded-xl hover:bg-[#e6c850] transition-colors text-sm flex items-center gap-2"
          >
            <span>📥</span> Download PNG
          </button>
          <button
            onClick={downloadPDF}
            className="px-5 py-2.5 bg-[#d4af37] text-[#0a0a0a] font-bold rounded-xl hover:bg-[#e6c850] transition-colors text-sm flex items-center gap-2"
          >
            <span>📄</span> Download PDF
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors text-sm flex items-center gap-2"
          >
            <span>🖨️</span> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left: Preview Card */}
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37] bg-[#d4af37]/10 px-3 py-1 rounded-full mb-4 no-print">
            Live Restaurant Stand Preview
          </span>

          <div id="printable-stand" ref={standRef} className="w-full max-w-sm bg-white text-black p-8 rounded-2xl shadow-2xl border-4 border-[#d4af37] my-4 flex flex-col items-center">
            <img src="/patel-logo-gold.png" alt="Patel Restaurant" crossOrigin="anonymous" className="h-16 w-auto object-contain mb-2" />
            <h2 className="text-xl font-black uppercase tracking-tight text-[#0a0a0a]">{restaurantName}</h2>
            {tagline ? (
              <p className="text-xs font-semibold text-[#8a7322] uppercase tracking-widest mb-4">{tagline}</p>
            ) : (
              <div className="mb-4" />
            )}

            <div className="p-3 bg-white border-2 border-gray-200 rounded-xl mb-4 shadow-inner">
              <img
                src={qrImgSrc}
                crossOrigin="anonymous"
                alt="Menu QR Code"
                className="w-48 h-48 object-contain"
              />
            </div>

            {tableNumber.trim() ? (
              <div className="bg-[#0a0a0a] text-white px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider mb-2">
                Table {tableNumber.trim()}
              </div>
            ) : null}

            <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Scan for Patel Restaurant menu
            </p>
          </div>

          <div className="flex gap-3 mt-4 flex-wrap justify-center no-print">
            <a
              href="/qr-home.png"
              download="patel-landing-qr.png"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
            >
              📥 Landing Page QR (PNG)
            </a>
            <a
              href="/qr-menu.svg"
              download="patel-menu-qr.svg"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
            >
              📥 Menu QR (SVG)
            </a>
            <a
              href={qrUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/30 rounded-xl text-sm font-medium transition-colors"
            >
              🔗 Open Live Menu ↗
            </a>
          </div>
        </div>

        {/* Right: Settings & Instructions */}
        <div className="space-y-6 no-print">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Customize QR Stand</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Destination URL
                </label>
                <input
                  type="text"
                  readOnly
                  value={liveUrl}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white/70 font-mono text-sm cursor-not-allowed"
                />
                <p className="text-xs text-secondary mt-1">This is your live production deployment on Vercel.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Table Number <span className="text-secondary font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5, 12, VIP-1"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white text-sm focus:ring-2 focus:ring-[#d4af37] focus:outline-none"
                />
                <p className="text-xs text-secondary mt-1">Leave blank for a general table stand, or enter a number to create custom table cards.</p>
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-3">How Table Ordering Works</h3>
            <ol className="space-y-3 text-sm text-secondary list-decimal list-inside">
              <li>Print the stand card or save the high-res PNG image.</li>
              <li>Place the QR card inside acrylic table stands or on the table corners.</li>
              <li>Customers open their mobile camera (iPhone / Android) and scan the code.</li>
              <li>The live digital menu opens instantly with 300+ dishes, realistic photos, and categories.</li>
            </ol>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #printable-stand, #printable-stand * { visibility: visible; }
          #printable-stand {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

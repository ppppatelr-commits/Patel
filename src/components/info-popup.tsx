'use client';

interface InfoPopupProps {
  open: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
}

export default function InfoPopup({ open, title, message, buttonLabel = 'Continue Shopping', onClose }: InfoPopupProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#141414] border border-[#d4af37]/30 rounded-2xl p-5 text-center">
        <h3 className="text-lg font-bold text-[#d4af37] mb-2">{title}</h3>
        <p className="text-sm text-secondary mb-4 whitespace-pre-line">{message}</p>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#d4af37] text-[#0a0a0a] font-bold text-sm hover:bg-[#e6c850]"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
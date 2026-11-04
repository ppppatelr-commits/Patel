export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dish: string }> }
) {
  const { dish } = await params;
  const decodedDish = decodeURIComponent(dish);
  const words = decodedDish.split(' ').slice(0, 2).join(' ');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <rect width="600" height="600" fill="#0a0a0a" />
      <rect x="50" y="50" width="500" height="500" fill="#141414" stroke="#d4af37" stroke-width="2" rx="20" />
      <circle cx="300" cy="260" r="90" fill="#d4af37" opacity="0.15" />
      <circle cx="300" cy="260" r="70" fill="none" stroke="#d4af37" stroke-width="1" opacity="0.3" />
      <text x="300" y="330" font-family="serif" font-size="28" font-weight="bold" fill="#d4af37" text-anchor="middle" letter-spacing="2">${words}</text>
      <text x="300" y="520" font-family="sans-serif" font-size="14" fill="#666" text-anchor="middle">AI Image Placeholder</text>
    </svg>
  `;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

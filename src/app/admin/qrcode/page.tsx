import { getPublicMenu } from '@/lib/public-menu';
import QRCodeClient from './qrcode-client';

export const dynamic = 'force-dynamic';

export default async function QRCodePage() {
  const { settings } = await getPublicMenu();
  const name = settings.name || 'PATEL RESTAURANT';
  const tagline =
    settings.tagline === undefined || settings.tagline === null
      ? 'Premium Authentic Indian Cuisine'
      : settings.tagline;

  return <QRCodeClient initialName={name} initialTagline={tagline.trim()} />;
}

import { getPublicMenu } from '@/lib/public-menu';
import MenuClient from './menu-client';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const menu = await getPublicMenu();

  return (
    <MenuClient
      initialSettings={menu.settings}
      initialCategories={menu.categories}
      initialItems={menu.items}
    />
  );
}

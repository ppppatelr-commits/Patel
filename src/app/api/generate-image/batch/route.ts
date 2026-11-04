import { NextRequest, NextResponse } from 'next/server';
import { MENU_DATA } from '@/lib/menu-data';
import { generateDishImage } from '@/lib/image-generation';
import { dishImageExists } from '@/lib/image-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requested: string[] = Array.isArray(body?.dishes) ? body.dishes.map((d: unknown) => String(d)) : [];
    const regenerate: boolean = body?.regenerate === true;

    const dishList: Array<{ dish: string; category: string | null }> = requested.length > 0
      ? requested.map((d) => ({ dish: d, category: null }))
      : Object.entries(MENU_DATA.items as unknown as Record<string, { name: string; price: number }[]>).flatMap(
          ([catName, items]) => items.map((i) => ({ dish: i.name, category: catName }))
        );

    const results: Array<{ dish: string; category: string | null; ok: boolean; error?: string; skipped?: boolean }> = [];

    for (const { dish, category: cat } of dishList) {
      const category = cat || (() => {
        const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number }[]>;
        for (const [catName, catItems] of Object.entries(itemsRecord)) {
          const hit = catItems.find((i) => i.name.toLowerCase() === dish.toLowerCase());
          if (hit) return catName;
        }
        return null;
      })();

      const exists = await dishImageExists({ dish, category: category || '' });
      if (exists && !regenerate) {
        results.push({ dish, category, ok: true, skipped: true });
        continue;
      }

      const result = await generateDishImage(dish, category);
      results.push({
        dish,
        category,
        ok: result.success,
        error: result.error,
        skipped: false,
      });
    }

    const succeeded = results.filter((r) => r.ok && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.ok && !r.skipped).length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded,
      skipped,
      failed,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Batch image generation failed', details: (err as Error).message }, { status: 500 });
  }
}

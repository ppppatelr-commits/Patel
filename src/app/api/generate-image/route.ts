import { NextRequest, NextResponse } from 'next/server';
import { generateDishImage } from '@/lib/image-generation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dish = (body?.dish || 'delicious food').toString().trim();
    const category = body?.category ? body.category.toString().trim() : null;

    const result = await generateDishImage(dish, category);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'AI image generation failed', dish, prompt: result.prompt },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dish: result.dish,
      category: result.category,
      prompt: result.prompt,
      imageUrl: result.imageUrl,
      filename: result.filename,
      filePath: result.filePath,
      mediaId: result.mediaId,
      categoryId: result.categoryId,
      saved: result.saved,
    });
  } catch (err) {
    return NextResponse.json({ error: 'AI image generation error', details: (err as Error).message }, { status: 500 });
  }
}

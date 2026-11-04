import { MENU_DATA } from '@/lib/menu-data';
import { saveDishImage, buildDishImageUrl } from '@/lib/image-storage';

export const BASE_PROMPT = (dish: string) =>
  `ultra-realistic premium restaurant menu food photo of ${dish}. dark charcoal black matte stone surface. soft warm studio lighting. 45 degree angle. matte black ceramic plate. centered. realistic texture. ultra-sharp. square 1:1. no text/logos/watermarks/hands/cutlery.`;

const DISH_DETAILS: Record<string, string> = {
  butterchicken: 'tandoori-style chicken pieces in creamy orange-red butter gravy with natural butter highlights and authentic Indian restaurant presentation.',
  chickenbiryani: 'long-grain basmati rice with authentic cooked chicken pieces, fried onions and saffron, realistic biryani texture.',
  crispychicken: 'golden-brown fried chicken with visible crunchy coating and realistic crispy texture.',
  paneertikka: 'grilled paneer cubes with authentic spices and char marks, natural grilled texture.',
  chickenmanchowsoup: 'authentic dark manchow soup with chicken and vegetables and crispy fried noodles.',
  muttonpaya: 'authentic traditional mutton paya broth with visible mutton trotters and realistic soup texture.',
  chickencurry: 'authentic Indian restaurant chicken curry with rich gravy, visible spices and tender chicken pieces.',
  muttcurry: 'authentic Indian restaurant mutton curry with rich gravy, visible spices and tender mutton pieces.',
  vegcurry: 'authentic Indian restaurant vegetable curry with fresh vegetables and rich spiced gravy.',
  paneercurry: 'authentic Indian restaurant paneer curry with rich gravy and fresh paneer.',
  fishcurry: 'authentic Indian restaurant fish curry with rich gravy and fresh fish pieces.',
};

export function buildPrompt(dish: string): string {
  const key = dish.toLowerCase().replace(/[^a-z0-9]/g, '');
  const details = DISH_DETAILS[key];
  const description = details ? `${dish}: ${details}` : `${dish}: authentic Indian restaurant dish, realistic ingredients, professional plating, premium presentation.`;
  return `${BASE_PROMPT(dish)} ${description}`;
}

export function findCategoryForDish(dish: string): string | null {
  const itemsRecord = MENU_DATA.items as unknown as Record<string, { name: string; price: number }[]>;
  for (const [catName, catItems] of Object.entries(itemsRecord)) {
    const hit = catItems.find((i) => i.name.toLowerCase() === dish.toLowerCase());
    if (hit) return catName;
  }
  return null;
}

export interface GenerateDishResult {
  success: boolean;
  dish: string;
  category: string | null;
  prompt: string;
  imageUrl: string | null;
  filename: string | null;
  filePath: string | null;
  mediaId: string | null;
  categoryId: string | null;
  saved: boolean;
  error?: string;
}

export async function generateDishImage(dish: string, category?: string | null): Promise<GenerateDishResult> {
  const finalDish = (dish || 'delicious food').toString().trim();
  const prompt = buildPrompt(finalDish);
  const apiKey = process.env.AI_IMAGE_GENERATION_API_KEY;
  const aiUrl = process.env.AI_IMAGE_GENERATION_URL;

  // Treat placeholder values as "not configured" so we fall back to free generation
  const isConfigured =
    !!apiKey &&
    !!aiUrl &&
    !apiKey.toLowerCase().includes('your-') &&
    !aiUrl.includes('example.com') &&
    aiUrl.startsWith('http');

  let imageBuffer: Buffer | null = null;
  let mimeType = 'image/webp';

  if (isConfigured) {
    // Configured AI endpoint (paid)
    const res = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.AI_IMAGE_GENERATION_MODEL || 'gpt-image-1', prompt, n: 1, size: '1024x1024' }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, dish: finalDish, category: category || null, prompt, imageUrl: null, filename: null, filePath: null, mediaId: null, categoryId: null, saved: false, error: `AI image generation failed: ${errText}` };
    }

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json || data?.b64_json;
    const url = data?.data?.[0]?.url || data?.url || data?.image_url;

    if (b64) {
      imageBuffer = Buffer.from(b64, 'base64');
      mimeType = data?.data?.[0]?.mime || data?.mime || 'image/webp';
    } else if (url) {
      const imgRes = await fetch(url);
      const arrayBuffer = await imgRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/webp';
    }
  } else {
    // Free fallback: Pollinations.ai (no API key required)
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=flux`;
    console.log('Fetching pollinations, url length:', pollinationsUrl.length);
    try {
      const imgRes = await fetch(pollinationsUrl);
      console.log('Pollinations status:', imgRes.status);
      if (!imgRes.ok) {
        return { success: false, dish: finalDish, category: category || null, prompt, imageUrl: null, filename: null, filePath: null, mediaId: null, categoryId: null, saved: false, error: `Free image generation failed: HTTP ${imgRes.status}` };
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/webp';
      console.log('Pollinations bytes:', arrayBuffer.byteLength);
    } catch (fetchErr) {
      console.error('Pollinations fetch error:', fetchErr);
      return { success: false, dish: finalDish, category: category || null, prompt, imageUrl: null, filename: null, filePath: null, mediaId: null, categoryId: null, saved: false, error: `Free image generation failed: ${(fetchErr as Error).message}` };
    }
  }

  if (!imageBuffer) {
    return { success: false, dish: finalDish, category: category || null, prompt, imageUrl: null, filename: null, filePath: null, mediaId: null, categoryId: null, saved: false, error: 'Image generation returned no image' };
  }

  const catName = category || findCategoryForDish(finalDish) || 'PATEL SPECIAL';
  const saved = await saveDishImage({ dish: finalDish, category: catName, buffer: imageBuffer, mimeType });
  const filename = saved.filename;
  const fileUrl = saved.fileUrl;

  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient() as any;

  let mediaId: string | null = null;
  let categoryId: string | null = null;

  if (supabase) {
    const { data: catData } = await supabase.from('menu_categories').select('id, name').ilike('name', catName).single();
    categoryId = catData?.id || null;

    const { data: itemData } = await supabase.from('menu_items').select('id').ilike('name', finalDish).limit(1).maybeSingle();

    const { data: mediaData, error: mediaError } = await supabase
      .from('media_library')
      .upsert([{
        dish_name: finalDish,
        filename,
        original_name: finalDish,
        file_path: saved.filePath,
        file_url: fileUrl,
        mime_type: mimeType,
        category_id: categoryId,
        menu_item_id: itemData?.id || null,
        status: 'active',
      }], { onConflict: 'filename' })
      .select()
      .single();

    if (mediaError) {
      return { success: false, dish: finalDish, category: catName, prompt, imageUrl: null, filename, filePath: saved.filePath, mediaId: null, categoryId, saved: true, error: `Media record save failed: ${mediaError.message}` };
    }
    mediaId = mediaData?.id || null;
  }

  if (supabase && categoryId) {
    try {
      const { error: itemError } = await supabase.from('menu_items').update({ image_filename: filename, image_url: fileUrl }).ilike('name', finalDish);
      if (itemError) console.warn('Menu item image sync warning:', itemError.message);
    } catch (err) {
      console.warn('Menu item image sync skipped:', (err as Error).message);
    }
  }

  return {
    success: true,
    dish: finalDish,
    category: catName,
    prompt,
    imageUrl: fileUrl || buildDishImageUrl(catName, finalDish),
    filename,
    filePath: saved.filePath,
    mediaId,
    categoryId,
    saved: true,
  };
}

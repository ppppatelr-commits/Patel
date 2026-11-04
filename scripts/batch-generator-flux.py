import os
import sys
import time
import subprocess
from gradio_client import Client

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA_DIR = os.path.join(ROOT, "public", "media", "dishes")
MISSING_FILE = os.path.join(ROOT, "scripts", "missing-images.txt")
PROCESSOR_SCRIPT = os.path.join(ROOT, "scripts", "process-image.js")

CULINARY_DESCRIPTIONS = {
    # Tawa Fry
    "bheja-fry-plain-1pcs.webp": "Authentic Mumbai style whole goat brain bheja shallow-fried on flat tawa with turmeric, mild black pepper, green chillies, ginger and fresh green coriander",
    "bheja-masl-fry.webp": "Savory scrambled goat brain bhuna masala fry with thick spiced tomato-onion reduction, green chillies, cumin and cilantro",
    
    # Chicken Curries & Gravies
    "chicken-rashida.webp": "Royal Mughlai Chicken Rashida curry, tender chicken cuts simmered in a rich golden-amber almond, cashew and saffron aromatic spiced gravy",
    "chi-rajaraj-boneless.webp": "Boneless Chicken Rajaraj, succulent chicken tikka chunks cooked in a royal rich dark crimson gravy with caramelized onions and whole spices",
    "chi-lajawab-boneless.webp": "Boneless Chicken Lajawab, tender boneless chicken pieces in a thick spicy onion-tomato gravy layered with fried onions and fresh cream",
    "chi-lazeez-boneless.webp": "Boneless Chicken Lazeez, tender chicken cubes folded in a decadent mild cashew cream and saffron gravy with grated paneer garnish",
    "butter-chi-boneless.webp": "Authentic Boneless Butter Chicken, tandoori-roasted boneless chicken pieces swimming in silky orange-red makhani tomato-butter gravy with cream swirls and melting butter pat",
    "chi-begum-bahar-boneless.webp": "Boneless Chicken Begum Bahar, royal minced chicken and boneless chicken combination in a rich creamy Mughlai gravy with slivered almonds",
    "chi-mumtaz-boneless.webp": "Boneless Chicken Mumtaz, succulent boneless chicken in a velvety white cashew-yogurt gravy with mild fragrant spices and coriander",
    "chi-peshawari-boneless.webp": "Boneless Chicken Peshawari, robust North-Western frontier chicken curry cooked in an iron kadai with coarsely crushed coriander, black pepper and tomatoes",
    "chi-nawabi-boneless.webp": "Boneless Chicken Nawabi, royal Awadhi chicken curry with rich poppy seed and cashew paste, fried onions and cardamom",
    "chi-angara-boneless.webp": "Boneless Chicken Angara, smoky fiery crimson chicken curry infused with live charcoal smoke aroma and whole red chillies",
    "chi-tawa-boneless.webp": "Boneless Chicken Tawa, boneless chicken strips stir-fried on hot tawa with diced onions, capsicum, tomatoes and freshly crushed spices",
    "chi-hyderabadi-boneless.webp": "Boneless Chicken Hyderabadi, flavorful green and brown spiced chicken curry with mint, coriander, fried onions and coconut milk",
    "chi-tikka-msl-boneless.webp": "Boneless Chicken Tikka Masala, charred clay-oven chicken tikka chunks simmered in a spiced onion-tomato masala gravy with cream",
    "chi-white.webp": "Chicken White Curry, tender bone-in chicken pieces in an elegant silky white cashew and poppy seed gravy scented with green cardamom and white pepper",
    "chicken-akbari.webp": "Chicken Akbari, emperor style chicken curry cooked with dry fruits, saffron, caramelized onions and aromatic Mughlai spices",
    "chicken-kabuli.webp": "Chicken Kabuli, hearty Afghan-style chicken curry cooked with chickpeas, tomatoes and mild warming spices",
    "chicken-special-gravy.webp": "Hindustan Special Chicken Gravy, chef signature rich red chicken curry with roasted ground spices, ginger juliennes and fresh coriander",
    "murg-mussallam-full.webp": "Grand Royal Murg Mussallam Full, whole roasted chicken stuffed with spiced eggs and dry fruits, draped in rich fragrant Mughlai masala",
    "murg-mussallam-half.webp": "Royal Murg Mussallam Half, half roasted chicken in thick opulent saffron-almond gravy with boiled egg halves and coriander",
    "chi-88.webp": "Chicken 88, sizzling Indo-Chinese spicy chicken gravy with crisp bell peppers, garlic and red chilli sauce",
    "chi-moghlai.webp": "Chicken Moghlai, rich egg-enriched creamy chicken curry with cashew nut paste, golden fried onions and saffron",
    "chi-kolhapuri.webp": "Chicken Kolhapuri, fiery Maharashtrian chicken curry with deep crimson spicy gravy, dry roasted coconut and Kolhapuri lavangi chillies",
    "chi-handi.webp": "Chicken Handi, traditional clay pot chicken curry with succulent chicken pieces in a creamy spiced tomato-onion gravy",
    "chi-kadai.webp": "Chicken Kadai, chicken cooked in wok with crunchy bell peppers, chunky onion petals, fresh ginger and crushed coriander seeds",
    "chi-masala-fry.webp": "Chicken Masala Fry, semi-dry spiced chicken fry coated thickly in caramelized onions, garlic and garam masala",
    "chi-afgani.webp": "Chicken Afghani Gravy, succulent chicken cuts in a mild velvety white cream and hung curd sauce with cracked black pepper",
    "chi-tandoori-masala.webp": "Chicken Tandoori Masala, clay-oven roasted charred tandoori chicken simmered in rich spicy tomato-onion curry",
    "chi-palak.webp": "Chicken Palak, tender chicken chunks simmered in vibrant silky green spinach puree tempered with garlic and cumin",
    "hindustan-spl-gravy-dish.webp": "Hindustan Special Gravy Dish, restaurant signature rich Mughlai chicken curry with layered spices and cream",

    # Mutton Dishes
    "mtn-msl-fry.webp": "Mutton Masala Fry, semi-dry succulent mutton pieces coated in caramelized dark brown onion-ginger-garlic masala and roasted spices",
    "mtn-masala.webp": "Mutton Masala, tender bone-in mutton chunks simmered in rich spiced onion-tomato gravy with bone marrow aroma",
    "mtn-moghlai.webp": "Mutton Moghlai, royal rich mutton curry enriched with cashew paste, beaten eggs, saffron and whole aromatic spices",
    "mtn-kolhapuri.webp": "Mutton Kolhapuri, fiery deep crimson red mutton curry with roasted coconut and authentic Kolhapuri spices",
    "mtn-handi.webp": "Mutton Handi, slow-cooked clay pot mutton curry in a creamy aromatic onion-tomato gravy",
    "mtn-tawa.webp": "Mutton Tawa, shredded tender mutton stir-fried on hot iron griddle with onion petals, tomatoes and freshly cracked pepper",
    "mtn-afgani.webp": "Mutton Afghani, tender mutton cuts in a mild velvety white cashew-cream sauce with black pepper and cardamom",
    "mtn-white.webp": "Mutton White Curry, tender mutton in silky white cashew and poppy seed gravy scented with mace and green cardamom",
    "mtn-do-pyaza.webp": "Mutton Do Pyaza, tender mutton simmered with generous amounts of caramelized and sautéed pearl onions",
    "mtn-special-gravy.webp": "Hindustan Special Mutton Gravy, chef signature slow-cooked mutton in dark aromatic royal spiced gravy",
    "mtn-paya.webp": "Mutton Paya Curry, traditional slow-simmered rich golden mutton trotter bone broth with gelatinous marrow",
    "mtn-bhuna.webp": "Mutton Bhuna, slow-cooked tender mutton pieces with dark thick clinging roasted onion-tomato masala",
    "mtn-dal-gosht.webp": "Mutton Dal Gosht, succulent mutton pieces slow-cooked with yellow chana lentils, bottle gourd (doodhi) and ghee tadka",
    "mtn-kadai.webp": "Mutton Kadai, tender mutton cooked in wok with crunchy bell peppers, coriander seeds and ginger juliennes",
    "mtn-rogan-gosht.webp": "Mutton Rogan Josh, Kashmiri style tender mutton cooked with aromatic fennel, ginger and vibrant red ratan jot gravy",
    "mtn-lajawab.webp": "Mutton Lajawab, rich spiced mutton curry with layered fried onions and fresh cream",
    "mtn-angara.webp": "Mutton Angara, smoky fiery crimson mutton curry infused with live charcoal smoke and roasted red chillies",
    "mtn-hyderabadi.webp": "Mutton Hyderabadi, rich dark spiced mutton curry with mint, coriander, fried onions and aromatic spices",
    "mtn-lazeez.webp": "Mutton Lazeez, tender mutton pieces in decadent mild cashew cream and saffron gravy",
    "mtn-dabba-gosht.webp": "Mutton Dabba Gosht, tender boneless mutton baked in a rich creamy cashew gravy topped with baked egg layer and tomato slices",
    "mtn-palak.webp": "Mutton Palak, succulent mutton pieces slow-cooked in rich seasoned pureed spinach gravy with garlic tempering",
    "mutton-butter-fry.webp": "Mutton Butter Fry, succulent tender mutton tossed in rich creamy butter glaze with mild spices",
    "mutton-kabuli.webp": "Mutton Kabuli, Afghan style mutton curry cooked with chickpeas, tomatoes and fragrant spices",
    "mutton-rashida.webp": "Mutton Rashida, royal Mughlai rich amber mutton curry with almond-cashew paste and saffron",
    "mutton-plain-fry.webp": "Mutton Plain Fry, simple pan-seared tender mutton pieces seasoned with turmeric, black pepper and salt",

    # Veg Currys
    "veg-kadai.webp": "Veg Kadai, colorful medley of carrots, beans, peas and cauliflower wok-tossed with chunky bell peppers, onion petals, ginger juliennes and crushed coriander seeds in tomato gravy",
    "veg-jaipur.webp": "Veg Jaipuri, royal Rajasthani style mixed vegetables simmered in creamy cashew-tomato gravy garnished with roasted papad curls and grated paneer",
    "veg-makhanwala.webp": "Veg Makhanwala, mixed garden vegetables simmered in rich creamy orange-red makhani tomato-butter gravy with fresh cream swirls and butter",
    "veg-shahi-korma.webp": "Veg Shahi Korma, assorted seasonal vegetables braised in mild velvety white cashew-coconut cream gravy with golden raisins and slivered nuts",
    "veg-kolhapuri.webp": "Veg Kolhapuri, fiery Maharashtrian assorted vegetable curry with deep crimson red spicy gravy, dry roasted coconut and whole red chillies",
    "mix-veg.webp": "Mix Veg Curry, homestyle dry-curry of fresh carrots, beans, green peas, potatoes and cauliflower seasoned with cumin and garam masala",
    "aloo-gobi.webp": "Aloo Gobi, classic North Indian dry preparation of tender potato chunks and cauliflower florets sautéed with turmeric, cumin, ginger and fresh green chillies",
    "chana-masala.webp": "Chana Masala, plump tender chickpeas simmered in dark tangy spiced tea-infused onion-tomato gravy with sliced ginger juliennes and green chillies",
    "aloo-mutter.webp": "Aloo Mutter, tender potato cubes and sweet green peas in a flavorful homestyle spiced tomato-onion curry with fresh coriander",
    "aloo-palak.webp": "Aloo Palak, cubed tender potatoes simmered in smooth seasoned vibrant green spinach puree with garlic tempering",
    "dal-fry-butter.webp": "Dal Fry Butter, golden yellow toor dal tempered with ghee-fried cumin, garlic, red chillies and crowned with a generous melting pat of butter",
    "dal-tadka.webp": "Dal Tadka, silky golden yellow lentils topped with a sizzling aromatic tadka of desi ghee, roasted garlic flakes, cumin and whole dried red chillies",
    "dal-fry.webp": "Dal Fry, homestyle yellow lentil dal tempered with cumin seeds, finely diced onions, ripe tomatoes and freshly chopped coriander",
    "veg-chatpata.webp": "Veg Chatpata, tangy and spicy medley of sautéed vegetables tossed in bold chatpata chaat spices, green chillies and fresh lemon juice",

    # Paneer Dishes
    "paneer-lajawab.webp": "Paneer Lajawab, soft fresh paneer cubes in a rich royal onion-tomato gravy layered with fried onions, cream and grated paneer",
    "paneer-tawa.webp": "Paneer Tawa, pan-seared fresh paneer cubes tossed on flat iron griddle with diced onions, crunchy bell peppers, tomatoes and bhuna spices",
    "paneer-bhurji.webp": "Paneer Bhurji, scrambled fresh cottage cheese cooked with finely diced onions, juicy tomatoes, green chillies, turmeric and fresh cilantro",
    "paneer-masala.webp": "Paneer Masala, soft fresh paneer cubes cooked in a flavorful traditional spiced onion-tomato gravy with garam masala",
    "paneer-tikka-masala.webp": "Paneer Tikka Masala, charred clay-oven grilled paneer tikka cubes simmered in a thick spiced creamy tomato gravy with capsicum",
    "paneer-butter-masala.webp": "Paneer Butter Masala, velvety soft paneer cubes swimming in rich creamy orange-red tomato-butter makhani gravy with cream swirls",
    "paneer-kadai.webp": "Paneer Kadai, paneer cubes wok-cooked with chunky green bell peppers, onion petals, ginger juliennes and freshly crushed coriander seeds",
    "paneer-mutter.webp": "Paneer Mutter, classic North Indian curry of soft paneer cubes and sweet tender green peas in spiced tomato-onion gravy",
    "paneer-palak.webp": "Paneer Palak, fresh white paneer cubes floating in silky vibrant green pureed spinach gravy with garlic and cumin tempering",
    "paneer-chatpata.webp": "Paneer Chatpata, tangy and spicy paneer curry cooked with tomatoes, bold chaat spices, crushed black pepper and fresh green chillies",
    "paneer-angara.webp": "Paneer Angara, smoky fiery deep red paneer curry infused with live charcoal smoke aroma and roasted whole red chillies",
    "paneer-lazeez.webp": "Paneer Lazeez, decadent paneer cubes simmered in a delicate mild cashew-cream gravy with saffron hints and subtle spices"
}

def get_culinary_description(filename, dish_name, category):
    if filename in CULINARY_DESCRIPTIONS:
        return CULINARY_DESCRIPTIONS[filename]
    
    # Generic intelligent fallbacks based on dish name keywords
    lower_dish = dish_name.lower()
    lower_cat = category.lower()
    
    if "biryani" in lower_dish or "biryani" in lower_cat:
        return f"Fragrant royal dum biryani prepared with long-grain saffron basmati rice, tender seasoned meat, caramelized fried onions (birista) and fresh mint"
    if "pulao" in lower_dish or "pulav" in lower_dish or "pulav" in lower_cat:
        return f"Fragrant Indian basmati rice pilaf cooked with whole spices, green peas and aromatic seasonings"
    if "fried rice" in lower_dish or "rice" in lower_cat:
        return f"Wok-tossed Indo-Chinese fried rice with long grains, diced spring vegetables, scallions and balanced seasoning"
    if "noodles" in lower_dish or "noodles" in lower_cat:
        return f"Wok-tossed Indo-Chinese hakka noodles with shredded cabbage, bell peppers, carrots, spring onions and savory sauce"
    if "soup" in lower_dish or "soup" in lower_cat:
        return f"Hot authentic savory restaurant soup with rich broth, finely diced garnishes and aromatic seasoning"
    if "paneer" in lower_dish:
        return f"Fresh soft cottage cheese paneer cubes cooked in rich authentic aromatic spiced gravy"
    if "mutton" in lower_dish or "mtn" in lower_dish or "mutton" in lower_cat:
        return f"Tender bone-in mutton pieces slow-cooked in rich dark spiced Indian gravy with bone marrow juices"
    if "fish" in lower_dish or "fish" in lower_cat:
        return f"Fresh tender fish fillets cooked in authentic spiced coastal Indian curry"
    if "prawns" in lower_dish or "prawns" in lower_cat:
        return f"Plump juicy coastal prawns cooked in rich flavorful aromatic spiced preparation"
    if "roti" in lower_dish or "naan" in lower_dish or "roti" in lower_cat:
        return f"Freshly clay-oven baked Indian bread with golden toasted charred spots and light butter glaze"
    if "kebab" in lower_dish or "tikka" in lower_dish:
        return f"Charred clay-oven tandoori grilled specialty with smoky edges, fresh lemon wedge and sliced onions"
        
    return f"Authentic Indian restaurant {dish_name} prepared with traditional spices, fresh herbs, and professional plating"

def build_prompt(filename, dish_name, category):
    desc = get_culinary_description(filename, dish_name, category)
    lower_cat = category.lower()
    lower_dish = dish_name.lower()
    
    is_liquid = any(k in lower_cat or k in lower_dish for k in ["soup", "curry", "currys", "gravy", "dal", "mutton", "chicken", "handi", "kadai", "palak"])
    vessel = "deep matte black ceramic round bowl with smooth satin rim" if is_liquid else "heavy round matte black ceramic plate with smooth rim"
    
    prompt = (
        f"commercial food photography of authentic Indian {dish_name}, {desc}, "
        f"served centered in a {vessel}, "
        f"placed on a dark charcoal slate stone tabletop with fine natural mineral texture, "
        f"consistent 45 degree high angle view, soft warm directional studio lighting from front-right, "
        f"scattered whole black peppercorns and fresh green cilantro, "
        f"square 1:1 aspect ratio, photorealistic 8k, appetizing colors and natural food textures, "
        f"no text, no watermark, no logos, no hands, no cutlery, no spoons"
    )
    return prompt

def generate_batch(count=5):
    print("=" * 70)
    print("HINDUSTAN RESTAURANT — FREE BATCH GENERATOR (SDXL-Lightning & FLUX)")
    print("=" * 70)
    
    if not os.path.exists(MISSING_FILE):
        print(f"Missing file not found: {MISSING_FILE}")
        return
        
    with open(MISSING_FILE, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip()]
        
    if not lines:
        print("All dishes have already been generated!")
        return
        
    batch = lines[:count]
    print(f"Total remaining in queue: {len(lines)}")
    print(f"Processing next batch of {len(batch)} dishes...\n")
    
    print("Connecting to SDXL-Lightning client...")
    sdxl_client = None
    flux_client = None
    try:
        sdxl_client = Client("AP123/SDXL-Lightning")
        print("Connected to SDXL-Lightning successfully!")
    except Exception as e:
        print(f"Warning: could not connect to SDXL-Lightning: {e}")
        
    completed_files = []
    
    for idx, line in enumerate(batch):
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 4:
            continue
        filename, dish_name, category, folder = parts[0], parts[1], parts[2], parts[3]
        dest_path = os.path.join(MEDIA_DIR, folder, filename)
        
        print(f"[{idx + 1}/{len(batch)}] {dish_name} ({category}) -> {folder}/{filename}")
        
        if os.path.exists(dest_path):
            print("   -> File already exists, skipping.")
            completed_files.append(filename)
            continue
            
        prompt = build_prompt(filename, dish_name, category)
        print(f"   Prompt: {prompt[:90]}...")
        
        raw_image_path = None
        t0 = time.time()
        
        # Try SDXL-Lightning first (persistent, no ZeroGPU limit)
        if sdxl_client:
            try:
                res = sdxl_client.predict(
                    prompt,
                    "4-Step",
                    api_name="/generate_image"
                )
                raw_image_path = res
                print(f"   [SDXL-Lightning] Generated in {round(time.time() - t0, 1)}s")
            except Exception as e:
                print(f"   [SDXL-Lightning] Failed: {e}")
                
        # Fallback to FLUX if SDXL failed
        if not raw_image_path:
            if not flux_client:
                try:
                    flux_client = Client("black-forest-labs/FLUX.1-schnell")
                except Exception:
                    pass
            if flux_client:
                try:
                    t1 = time.time()
                    res = flux_client.predict(
                        prompt=prompt,
                        seed=42 + idx,
                        randomize_seed=True,
                        width=1024,
                        height=1024,
                        num_inference_steps=4,
                        api_name="/infer"
                    )
                    raw_image_path = res[0]
                    print(f"   [FLUX.1] Generated in {round(time.time() - t1, 1)}s")
                except Exception as e:
                    print(f"   [FLUX.1] Failed: {e}")
                    
        if raw_image_path and os.path.exists(raw_image_path):
            # Process and save through Node sharp processor
            cmd = ["node", PROCESSOR_SCRIPT, raw_image_path, folder, filename]
            ret = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
            if ret.returncode != 0:
                print(f"   Error in processing: {ret.stderr}")
            else:
                print(f"   {ret.stdout.strip()}")
                completed_files.append(filename)
        else:
            print(f"   Failed to generate image for {dish_name}")
            
        print()
        time.sleep(2)  # Polite 2s pause
        
    # Update missing-images.txt
    if completed_files:
        remaining_lines = [l for l in lines if not any(l.startswith(f) for f in completed_files)]
        with open(MISSING_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(remaining_lines))
        print("=" * 70)
        print(f"Batch completed: {len(completed_files)} images generated and saved.")
        print(f"Remaining dishes in queue: {len(remaining_lines)}")
        print("=" * 70)

if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    generate_batch(n)


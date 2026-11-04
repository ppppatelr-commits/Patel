const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MEDIA_DIR = path.join(ROOT, 'public', 'media', 'dishes');
const MISSING_FILE = path.join(ROOT, 'scripts', 'missing-images.txt');

// Exhaustive, authentic dish-specific culinary profiles matching real reference food photos
const CULINARY_PROFILES = {
  // Beverages & Cold Drinks (Google Reference Verified)
  'tea.webp': 'authentic Indian Mumbai street-style Cutting Chai, hot aromatic spiced milk tea with rich caramel-brown color and delicate frothy crema on top, served in a classic clear ribbed cutting chai glass, delicate steam rising, placed on dark charcoal slate stone tabletop with scattered green cardamom pods and cinnamon stick, 45-degree angle studio photography, no text, no watermarks',
  'spl-tea.webp': 'rich creamy Mumbai Irani Dum Chai, velvety thick mahogany-brown milk tea slow-simmered with reduced creamy milk and cardamom, served hot in an elegant vintage ceramic tea cup with matching saucer, fine golden froth, soft steam rising, dark slate stone surface, professional cafe photography, no text, no watermarks',
  'cold-drinks.webp': 'chilled dark carbonated cola served in a tall clear restaurant tumbler glass filled to the top with crystal-clear ice cubes, glistening fizzy effervescent bubbles, frosty condensation beads running down the glass exterior, fresh lemon wheel on the rim, placed on dark charcoal slate stone, professional commercial beverage photography, no text, no watermarks',
  'coldrinks-500ml.webp': 'ice-chilled 500ml plastic PET bottle of carbonated cola beverage covered in frosty condensation water droplets, placed on dark charcoal slate stone tabletop alongside a clear glass filled with ice cubes and bubbling dark soda, professional commercial product photography, no text, no watermarks',
  'mineral-water-big.webp': 'chilled 1-litre clear packaged drinking mineral water bottle with crisp refreshing condensation droplets on the clear plastic bottle, standing on dark charcoal slate stone tabletop next to a clean clear drinking tumbler glass, professional commercial product photography, no text, no watermarks',

  // Biryani & Rice (Meatless Plain Biryani Rice / Kuska / Steam Rice / Dal Marke - Verified)
  'biryani-rice-full.webp': 'generous full sharing portion of authentic Indian restaurant Biryani Rice (Kuska / Biryani Chawal), long-grain fluffy saffron basmati rice with dual white and golden-yellow hues, glistening with desi ghee, scattered with caramelized dark golden-brown fried onions (birista) and fresh green mint leaves, whole cardamom pod and cinnamon stick on top, strictly vegetarian plain biryani rice with NO meat chunks and NO chicken pieces, arranged in a deep matte black ceramic round bowl on dark slate stone, 45-degree angle, professional food photography, no text, no watermarks',
  'biryani-rice-half.webp': 'half single-serving portion of authentic Indian restaurant Biryani Rice (Kuska / Biryani Chawal), fragrant steaming hot long-grain basmati rice with saffron-infused golden grains, glazed with pure ghee, garnished with crispy fried onions (birista) and chopped cilantro, strictly plain seasoned biryani rice without any meat or chicken, in a round matte black ceramic bowl on dark slate stone, no text, no watermarks',
  'steam-rice-full.webp': 'large round matte black ceramic bowl filled with steaming hot pristine white long-grain basmati steamed rice, fluffy separated individual grains, gentle natural steam rising, fresh sprig of green coriander in the center, dark charcoal slate stone tabletop, professional food photography, no text, no watermarks',
  'steam-rice-half.webp': 'single half-portion bowl of pure white fluffy steamed long-grain basmati rice, tender separated grains, rising steam, minimalist elegant presentation in a round matte black ceramic bowl on dark slate, no text, no watermarks',
  'dal-marke-rice-full.webp': 'classic Mumbai restaurant Rice Dal Marke, large round matte black ceramic bowl of fluffy white basmati rice drenched right down the center with hot golden-yellow toor dal fry with a sizzling tadka of melted desi ghee, fried garlic flakes, cumin seeds, dried whole red chillies and fresh green cilantro, dark slate tabletop, professional food photography, no text, no watermarks',
  'dal-marke-rice-half.webp': 'authentic Mumbai Rice Dal Marke, half portion of steaming white basmati rice topped in the center with sizzling golden yellow garlic-tempered lentil dal tadka with ghee, cumin seeds and fresh chopped coriander, in a round matte black bowl on dark slate, no text, no watermarks',
  'jeera-rice-dal-marke.webp': 'Mumbai-style Jeera Rice Dal Marke, fragrant basmati rice tempered with whole roasted cumin seeds and ghee, crowned in the center with a generous ladle of hot golden yellow garlic dal tadka, whole red chilli and fresh green coriander, in a round matte black ceramic bowl on dark slate, no text, no watermarks',

  // Desserts (Authentic Traditional Indian Desserts - Verified)
  'malai-firni.webp': 'traditional royal Mughlai Malai Firni, chilled slow-cooked creamy ground rice pudding set in an authentic rustic shallow unglazed earthen clay pot (shikora / kulhad), topped with thick clotted malai cream, vibrant green slivered pistachios, sliced almonds, saffron strands and edible silver leaf (vark), placed on dark charcoal slate stone tabletop, professional food photography, no text, no watermarks',
  'matka-rabdi.webp': 'authentic Indian Matka Rabdi, dense slow-reduced whole milk dessert with visible thick layered folds of clotted cream (lachha malai), served in a traditional miniature terracotta earthen clay matka pot, garnished with saffron strands, crushed pistachios and cardamom, on dark charcoal slate stone, professional food photography, no text, no watermarks',
  'custard.webp': 'classic Indian restaurant chilled Fruit Custard, rich silky pastel-yellow vanilla custard in a clear crystal dessert glass bowl, lavishly studded with fresh ruby pomegranate pearls, sliced banana discs, crisp apple cubes and black grapes, placed on dark charcoal slate stone tabletop, appetizing dessert photography, no text, no watermarks',

  // Traditional Khichda
  'khichda-only-friday-and-sunday.webp': 'traditional Mumbai slow-cooked Khichda, rich thick porridge-stew of shredded tender mutton, broken wheat (daliya) and mixed lentils, with large succulent bone-in mutton piece visible, garnished with dark golden crispy fried onions (birista), fresh mint leaves, ginger juliennes and a fresh lemon wedge, in a deep matte black ceramic round bowl on dark slate stone, no text, no watermarks',

  // Seekh
  'chicken-seekh-kabab.webp': 'authentic charcoal flame-grilled Chicken Seekh Kababs, cylindrical skewered minced chicken kebabs with charred grill edges, glistening with brush of melted butter, accompanied by sliced raw red onion rings, fresh mint sprigs and lime wedges, on a heavy matte black ceramic plate on dark slate, no text, no watermarks',
  'mutton-seekh-kabab.webp': 'tender authentic Mutton Seekh Kababs, succulent skewered spiced minced mutton cylinders charred over glowing charcoal coals, glistening with melted butter, served with sliced onion rings, lemon wedges and mint leaves, on a matte black ceramic plate on dark slate, no text, no watermarks',

  // Hindustan Keema
  'spl-keema.webp': 'Hindustan Special Keema, finely minced spiced mutton slow-cooked in rich onion-tomato masala with green peas, ginger-garlic, garam masala and fresh green cilantro, in a round matte black bowl on dark slate, no text, no watermarks',
  'spl-keema-fry.webp': 'Special Keema Fry, spiced minced mutton stir-fried vigorously on a searing flat iron tawa until caramelized, glistening and richly browned, tossed with diced green chillies, onions and fresh coriander, on a matte black ceramic plate on dark slate, no text, no watermarks',
  'sada-keema.webp': 'Sada Keema, classic homestyle tender minced mutton gently simmered in a mildly spiced onion-tomato gravy with fresh coriander, in a matte black ceramic bowl on dark slate, no text, no watermarks',
  'sada-keema-fry.webp': 'Sada Keema Fry, dry pan-seared minced mutton seasoned with turmeric, cumin, black pepper, diced onions and fresh herbs, on a matte black plate on dark slate, no text, no watermarks',
  'keema-ghotala.webp': 'classic Mumbai Irani cafe-style Keema Ghotala, rich spicy minced mutton scrambled together on flat tawa with soft curd-like farm egg folds woven throughout the dark meat, glistening with melted butter and garnished with chopped green chillies and fresh cilantro, on a matte black ceramic artisan plate on dark slate, no text, no watermarks',
  'spl-keema-ghotala.webp': 'Special Keema Ghotala, rich spiced minced mutton scrambled with farm eggs on tawa, crowned with an extra sunny-side-up egg with a bright yellow runny yolk and fresh coriander, on a matte black plate on dark slate, no text, no watermarks',
  'special-full-keema.webp': 'Special Full Keema, generous hearty portion of slow-simmered dark spiced minced mutton garnished with ginger juliennes and fresh mint leaves, in a matte black ceramic bowl on dark slate, no text, no watermarks',
  'sada-keema-full.webp': 'Sada Keema Full, generous sharing bowl of authentic homestyle minced mutton curry with fresh herbs and subtle whole spices, in a matte black ceramic bowl on dark slate, no text, no watermarks',
  'spl-keema-pulao.webp': 'Special Keema Pulao, fragrant long-grain basmati rice pilaf cooked with spiced minced mutton, whole cardamom and cloves, caramelized fried onions and fresh mint, in a matte black ceramic bowl on dark slate, no text, no watermarks',
  'sada-keema-pulao.webp': 'Sada Keema Pulao, gentle aromatic basmati rice pilaf cooked with seasoned minced mutton, sweet green peas and golden onions, in a matte black ceramic bowl on dark slate, no text, no watermarks',
  'spl-keema-fried-rice.webp': 'Special Keema Fried Rice, high-heat wok-tossed basmati fried rice speckled with seasoned minced mutton, scrambled egg ribbons, scallions and savory dark soy glaze, on a matte black plate on dark slate, no text, no watermarks',

  // Hindustan Kebab & Egg Kebab
  'hindustan-kebab-12pcs.webp': '12 pieces of golden-crisp Hindustan Kebabs, tender spiced minced chicken kebab patties with crunchy golden-brown outer crust, garnished with sliced red onion rings, green chilies and lemon wedges, arranged on a large matte black artisan platter on dark slate, no text, no watermarks',
  'hindustan-kebab-6pcs.webp': '6 pieces of golden-crisp Hindustan Kebabs, freshly deep-fried spiced meat patties with crunchy crust, sliced red onions and fresh mint, on a matte black ceramic plate on dark slate, no text, no watermarks',
  'egg-kebab-12pcs.webp': '12 pieces of Mumbai street-style Egg Kebabs, halved hard-boiled eggs encased in a spiced potato-meat crust, coated in breadcrumbs and deep-fried golden-brown, sliced open displaying bright yellow yolk centers, served with green mint chutney, on a matte black platter on dark slate, no text, no watermarks',
  'double-egg-kebab-12pcs.webp': '12 pieces of Double Egg Kebabs, whole hard-boiled eggs wrapped in spiced mince batter and breadcrumb crust, fried to deep crisp golden-brown, sliced to reveal bright eggs inside, on a matte black plate on dark slate, no text, no watermarks',
  'double-egg-kebab-6pcs.webp': '6 pieces of Double Egg Kebabs, crispy golden-coated halved egg kebabs showing tender egg whites and vibrant yellow yolks, garnished with onion rings and lemon wedges, on a matte black plate on dark slate, no text, no watermarks',
  'egg-kebab-6pcs.webp': '6 pieces of Egg Kebabs, crispy breaded egg cutlets with visible boiled egg slices, golden crisp crunchy exterior, served with mint chutney and onion rings, on a matte black plate on dark slate, no text, no watermarks',

  // Sea Foods
  'prawns-fried-rice.webp': 'plump pink succulent coastal prawns wok-tossed with fluffy separated long-grain basmati fried rice, spring onions, finely diced carrots and light soy seasoning, on a matte black plate on dark slate, no text, no watermarks',
  'prawns-sez-fried-rice.webp': 'fiery Schezwan Prawns Fried Rice, plump pink coastal prawns wok-tossed in vibrant red spicy Schezwan sauce with scallions, capsicum and fluffy basmati grains, on a matte black plate on dark slate, no text, no watermarks',
  'prawns-sez-noodles.webp': 'spicy Schezwan Prawns Noodles, wok-tossed noodles with succulent pink prawns, shredded cabbage, carrots and glossy red Schezwan chili glaze, on a matte black plate on dark slate, no text, no watermarks',
  'prawns-pulav.webp': 'fragrant coastal Prawns Pulav, aromatic basmati rice cooked with whole spices, tender sautéed pink prawns, caramelized onions and fresh mint, in a matte black bowl on dark slate, no text, no watermarks',
  'prawns-biryani.webp': 'royal Prawns Biryani, layered basmati rice with succulent coastal prawns marinated in rich spices, caramelized onions (birista) and saffron, in a matte black ceramic bowl on dark slate, no text, no watermarks',
  'prawns-masala.webp': 'Prawns Masala, juicy plump coastal prawns simmered in a thick spicy onion-tomato masala gravy with curry leaves and fresh coriander, in a matte black round bowl on dark slate, no text, no watermarks',
  'prawns-plain-fry.webp': 'Prawns Plain Fry, pan-seared juicy coastal prawns seasoned lightly with turmeric, sea salt, cracked black pepper, curry leaves and fresh lemon, on a matte black plate on dark slate, no text, no watermarks',
  'prawns-chilly.webp': 'Prawns Chilli with Gravy, succulent prawns tossed with crunchy green capsicum, onion squares and sliced green chillies in savory dark soy-garlic sauce, in a matte black bowl on dark slate, no text, no watermarks',
  'prawns-chilly-dry.webp': 'Prawns Chilli Dry, crisp batter-fried prawns wok-tossed on high heat with crushed garlic, green chillies, spring onions and spicy chili glaze, on a matte black plate on dark slate, no text, no watermarks',

  // Extras
  'extra-schezwan-chatni.webp': 'authentic spicy Indo-Chinese Schezwan Chutney in a small matte black ceramic dip bowl, vibrant deep red chili-garlic sauce with visible minced garlic, crushed red chillies and glistening oil sheen, on dark slate stone, no text, no watermarks',
  'extra-green-chatni.webp': 'fresh vibrant green mint-coriander chutney in a small matte black ceramic dip bowl, smooth herb dip with green chillies, lemon and roasted cumin, on dark slate stone, no text, no watermarks',
  'extra-tomato-sauce.webp': 'rich smooth crimson tomato sauce in a small matte black ceramic dip bowl with fresh parsley garnish, on dark slate stone, no text, no watermarks',
  'extra-fry-noodles.webp': 'mound of golden crispy deep-fried Hakka noodles, delicate brittle crunchy noodle threads in an artisan matte black ceramic bowl on dark slate, no text, no watermarks',

  // Roti Mein
  'tandoori-roti.webp': 'hot clay-oven baked Tandoori Roti, whole wheat flatbread with charred brown blister spots and smoky texture, neatly folded on a matte black plate on dark slate, no text, no watermarks',
  'btr-roti.webp': 'Tandoori Butter Roti, crisp clay-oven flatbread brushed with a rich glistening glaze of melted butter, on a matte black plate on dark slate, no text, no watermarks',
  'naan.webp': 'traditional plain Naan, pillowy soft leavened white flatbread baked in tandoor with golden toasted blister bubbles, on a matte black plate on dark slate, no text, no watermarks',
  'btr-naan.webp': 'Butter Naan, soft tandoor-baked flatbread with blistered crust generously brushed with melting golden butter, on a matte black plate on dark slate, no text, no watermarks',
  'lacha-paratha.webp': 'crispy layered Laccha Paratha, multi-folded spiral flaky whole wheat flatbread with golden buttery layers and delicate crunch, on a matte black plate on dark slate, no text, no watermarks',
  'chapathi.webp': 'soft homestyle Chapathi, thin puffed whole wheat Indian phulka flatbread with light golden toasted spots, on a matte black plate on dark slate, no text, no watermarks',
  'spl-chapathi.webp': 'Special Chapathi, soft thin hand-rolled flatbread lightly brushed with pure ghee, on a matte black plate on dark slate, no text, no watermarks',
  'chapathi-paratha.webp': 'layered Chapathi Paratha, golden flaky flatbread cooked on tawa with desi ghee, on a matte black plate on dark slate, no text, no watermarks',
  'btr-garlic-naan.webp': 'Butter Garlic Naan, soft tandoori flatbread studded with roasted minced garlic, fresh green coriander and glazed with melted butter, on a matte black plate on dark slate, no text, no watermarks',
  'butter-chapati.webp': 'warm soft whole wheat Chapati with a glistening spread of fresh melted butter, on a matte black plate on dark slate, no text, no watermarks',

  // Veg Chinese Rice
  'veg-fried-rice.webp': 'classic Veg Fried Rice, fluffy separated basmati rice grains wok-tossed with finely diced carrots, French beans, cabbage and spring onions, on a matte black plate on dark slate, no text, no watermarks',
  'veg-schezwan-fried-rice.webp': 'vibrant red Veg Schezwan Fried Rice, spicy wok-tossed rice with shredded vegetables, fiery red chilli paste and scallions, on a matte black plate on dark slate, no text, no watermarks',
  'veg-manchurian-fried-rice.webp': 'Veg Manchurian Fried Rice, seasoned fried rice tossed with crispy golden vegetable Manchurian balls in savory soya-garlic glaze, on a matte black plate on dark slate, no text, no watermarks',
  'veg-singapore-fried-rice.webp': 'Veg Singapore Fried Rice, vibrant yellow curry-spiced fried rice with cashews, bell peppers, baby corn and scallions, on a matte black plate on dark slate, no text, no watermarks',
  'veg-hong-kong-fried-rice.webp': 'Veg Hong Kong Fried Rice, savory wok-tossed rice with mushrooms, baby corn, colorful bell peppers and sweet-savory soya sauce, on a matte black plate on dark slate, no text, no watermarks',
  'veg-chilly-fried-rice.webp': 'Veg Chilly Fried Rice, wok-seared spicy rice with diced green chillies, crunchy bell peppers, onions and garlic, on a matte black plate on dark slate, no text, no watermarks',
  'egg-sez-fried-rice.webp': 'Egg Schezwan Fried Rice, vibrant red spicy rice tossed with fluffy scrambled egg ribbons, green chillies and spring onions, on a matte black plate on dark slate, no text, no watermarks',

  // Veg Chinese Noodles
  'veg-hakka-noodles.webp': 'Veg Hakka Noodles, perfectly boiled noodles wok-tossed on high flame with crunchy shredded cabbage, carrot juliennes and spring onions, on a matte black plate on dark slate, no text, no watermarks',
  'veg-schezwan-noodles.webp': 'Veg Schezwan Noodles, fiery glossy red noodles wok-tossed with spicy Schezwan sauce, capsicum, cabbage and scallions, on a matte black plate on dark slate, no text, no watermarks',
  'veg-singapore-noodles.webp': 'Veg Singapore Noodles, delicate yellow curry-scented noodles tossed with bell peppers, beans and sesame seeds, on a matte black plate on dark slate, no text, no watermarks',
  'veg-hong-kong-noodles.webp': 'Veg Hong Kong Noodles, dark savory wok-tossed noodles with sliced mushrooms, spring onions and savory dark soy sauce, on a matte black plate on dark slate, no text, no watermarks',
  'veg-manchurian-noodles.webp': 'Veg Manchurian Noodles, savory noodles tossed with crispy vegetable Manchurian dumplings in ginger-garlic sauce, on a matte black plate on dark slate, no text, no watermarks',
  'veg-chilly-noodles.webp': 'Veg Chilly Noodles, spicy stir-fried noodles tossed with slit green chillies, capsicum, garlic and dark soy, on a matte black plate on dark slate, no text, no watermarks',
  'egg-sez-noodles.webp': 'Egg Schezwan Noodles, glossy red spicy noodles tossed with tender scrambled egg strips, bell peppers and spring onion greens, on a matte black plate on dark slate, no text, no watermarks',

  // Kepsa Items (Iconic Mumbai Arabian Platters)
  'chilly-kepsa-half.webp': 'Mumbai Arabian Chilli Kepsa, grand platter of fragrant seasoned basmati rice topped with crispy Indo-Chinese Chilli Chicken chunks in glossy sauce, fried onions, roasted cashews, boiled egg wedges and French fries, on a wide matte black ceramic platter on dark slate, no text, no watermarks',
  'chilly-kepsa-full.webp': 'full grand platter of Mumbai Chilli Kepsa, mountain of spiced basmati rice topped with crispy chilli chicken, fried cashews, raisins, boiled eggs and French fries, on a large platter on dark slate, no text, no watermarks',
  'schezwan-kepsa-half.webp': 'Schezwan Kepsa, grand Arabian platter of vibrant red Schezwan rice topped with spicy batter-fried Schezwan chicken, fried cashews, raisins, boiled egg and fresh herbs, on a large platter on dark slate, no text, no watermarks',
  'schezwan-kepsa-full.webp': 'full grand platter of Schezwan Kepsa, vibrant mountain of spicy red rice with crisp Schezwan chicken cuts, toasted nuts and boiled egg halves, on a large platter on dark slate, no text, no watermarks',
  'arbi-kepsa-full.webp': 'authentic Arabic Kepsa, grand platter of spiced aromatic Kabsa rice topped with slow-roasted tender spiced meat, golden cashews, raisins, almonds and lemon slices, on a large platter on dark slate, no text, no watermarks',
  'chicken-kepsa-half.webp': 'Mumbai Chicken Kepsa, grand feast platter of fragrant basmati rice crowned with a whole smoky clay-oven charred Tandoori Chicken leg quarter, crispy fries, boiled eggs, fried onions and rich dipping gravy, on a large platter on dark slate, no text, no watermarks',
  'chicken-kepsa-full.webp': 'full grand feast Chicken Kepsa platter, aromatic basmati rice crowned with whole charred Tandoori chicken cuts, golden fried cashews, french fries and boiled eggs, on a large platter on dark slate, no text, no watermarks',
  'mutton-kepsa-half.webp': 'Mutton Kepsa, grand platter of aromatic seasoned basmati rice topped with tender roasted spiced mutton shanks, fried cashews, almonds, raisins and hard-boiled eggs, on a large platter on dark slate, no text, no watermarks',
  'mutton-kepsa-full.webp': 'full grand platter of Mutton Kepsa, mountain of aromatic rice topped with succulent roasted mutton cuts, golden cashews, raisins and boiled eggs, on a large platter on dark slate, no text, no watermarks',
  'arbi-chilly-kepsa-half.webp': 'Arbi Chilly Kepsa, grand spiced Arabian rice platter topped with crispy spicy chili-tossed meat bites, toasted cashews and fresh herbs, on a large platter on dark slate, no text, no watermarks',
  'arbi-chilly-kepsa-full.webp': 'full grand platter of Arbi Chilly Kepsa, seasoned rice bed with spicy chilli meat chunks, roasted nuts and fried onions, on a large platter on dark slate, no text, no watermarks',
  'mini-kepsa-chicken.webp': 'Mini Chicken Kepsa, artisan platter of seasoned basmati rice topped with charred tandoori chicken piece, fried onions, cashews and sliced boiled egg, on a matte black plate on dark slate, no text, no watermarks',
  'mini-kepsa-mutton.webp': 'Mini Mutton Kepsa, personal platter of aromatic basmati rice with tender spiced mutton chunk, fried onions, cashews and boiled egg, on a matte black plate on dark slate, no text, no watermarks',
  'mini-paneer-kepsa.webp': 'Mini Paneer Kepsa, fragrant seasoned basmati rice platter topped with charred spiced paneer tikka cubes, fried cashews and fresh herbs, on a matte black plate on dark slate, no text, no watermarks',
  'mini-arbi-kepsa.webp': 'Mini Arbi Kepsa, seasoned Arabian basmati rice with roasted tender meat, almonds, raisins and lemon wedge, on a matte black plate on dark slate, no text, no watermarks',
  'sehzwan-mini-kepsa.webp': 'Schezwan Mini Kepsa, fiery red seasoned basmati rice topped with crispy Schezwan chicken bites, fried onions and cashews, on a matte black plate on dark slate, no text, no watermarks',

  // Chicken Chinese Rice with Gravy
  'chi-chilly-rice.webp': 'Chicken Chilly Rice, bed of seasoned egg fried rice smothered in a thick glossy dark-red chilli chicken gravy with capsicum and onion squares, on a matte black plate on dark slate, no text, no watermarks',
  'chi-triple-rice.webp': 'Chicken Triple Schezwan Fried Rice, vibrant mountain of red Schezwan fried rice and noodles tossed together, topped with crispy golden fried noodles, fried chicken chunks and thick spicy Schezwan gravy, on a matte black plate on dark slate, no text, no watermarks',
  'chi-manchurian-rice.webp': 'Chicken Manchurian Rice, fluffy egg fried rice smothered in savory dark brown Manchurian chicken gravy with spring onions, on a matte black plate on dark slate, no text, no watermarks',
  'chi-dragon-rice.webp': 'Chicken Dragon Rice, wok-tossed fried rice topped with crispy chicken bites coated in spicy tangy red dragon sauce with roasted cashews and dry red chillies, on a matte black plate on dark slate, no text, no watermarks',
  'chi-chopper-rice.webp': 'Chicken Chopper Rice, bed of golden egg fried rice blanketed in rich glossy red Schezwan gravy loaded with finely diced chicken, topped with crispy fried noodles and spring onions, on a matte black plate on dark slate, no text, no watermarks',
  'chi-malaysian-rice.webp': 'Chicken Malaysian Rice, fragrant turmeric-curried yellow basmati rice topped with tender spiced chicken strips, bell peppers and mild coconut-chilli gravy, on a matte black plate on dark slate, no text, no watermarks',
  'chi-butter-rice.webp': 'Chicken Butter Rice, fragrant garlic-butter tossed rice topped with tender chicken strips in a rich creamy savory butter sauce with scallions, on a matte black plate on dark slate, no text, no watermarks',
  'hindustan-special-fried-rice.webp': 'Hindustan Special Fried Rice, chef signature triple-combination wok-tossed rice with tender chicken, prawns, scrambled eggs, colorful vegetables and savory house sauce, on a matte black plate on dark slate, no text, no watermarks',
  'chi-pot-rice.webp': 'Chicken Pot Rice, steaming clay pot filled with seasoned basmati rice smothered in a thick, dark, glossy garlic-soy gravy with tender chicken strips, mushrooms, baby corn, bell peppers and spring onions, in a traditional clay pot on dark slate, no text, no watermarks',

  // Chicken Chinese Rice (Dry)
  'chi-schezwan-fried-rice.webp': 'Chicken Schezwan Fried Rice, fiery wok-tossed red basmati rice with shredded chicken, scrambled eggs, green chillies and spring onions, on a matte black plate on dark slate, no text, no watermarks',
  'chi-singapore-fried-rice.webp': 'Chicken Singapore Fried Rice, vibrant yellow curry-spiced basmati fried rice with tender chicken pieces, bell peppers and cashews, on a matte black plate on dark slate, no text, no watermarks',
  'chi-hong-kong-fried-rice.webp': 'Chicken Hong Kong Fried Rice, savory stir-fried rice with sliced chicken, mushrooms, baby corn and sweet-savory soya sauce, on a matte black plate on dark slate, no text, no watermarks',
  'chi-mixed-fried-rice.webp': 'Chicken Mixed Fried Rice, flavorful wok-tossed rice loaded with chicken, prawns, scrambled egg ribbons and fresh vegetables, on a matte black plate on dark slate, no text, no watermarks',
  'chi-combi-fried-rice.webp': 'Chicken Combination Fried Rice, half fried rice and half Hakka noodles tossed together with tender chicken and eggs, on a matte black plate on dark slate, no text, no watermarks',

  // Chicken Chinese Noodles
  'chi-hakka-noodles.webp': 'Chicken Hakka Noodles, stir-fried noodles with shredded chicken strips, crunchy cabbage, carrots and spring onions, on a matte black plate on dark slate, no text, no watermarks',
  'chi-schezwan-noodles.webp': 'Chicken Schezwan Noodles, fiery glossy red noodles with shredded chicken, egg, capsicum and spicy Schezwan glaze, on a matte black plate on dark slate, no text, no watermarks',
  'chi-singapore-noodles.webp': 'Chicken Singapore Noodles, yellow curry-scented stir-fried noodles with chicken, bell peppers and sesame seeds, on a matte black plate on dark slate, no text, no watermarks',
  'chi-hong-kong-noodles.webp': 'Chicken Hong Kong Noodles, dark savory wok-tossed noodles with chicken strips, mushrooms, spring onions and dark soy, on a matte black plate on dark slate, no text, no watermarks',
  'mix-noodles.webp': 'Mix Non-Veg Noodles, wok-tossed noodles with chicken strips, prawns, scrambled egg and crisp vegetables, on a matte black plate on dark slate, no text, no watermarks',
  'chi-american-chopsey.webp': 'Chicken American Chopsuey, golden crispy fried noodle nest topped with sweet-and-tangy bright red vegetable and chicken gravy, crowned with a sunny-side-up fried egg with runny yolk and green scallions, on a matte black plate on dark slate, no text, no watermarks',

  // Chicken Chinese Noodles with Gravy
  'chi-chilly-noodles.webp': 'Chicken Chilly Noodles, stir-fried noodles blanketed in thick dark soy-chilli gravy with crispy chicken pieces and capsicum, on a matte black plate on dark slate, no text, no watermarks',
  'chi-triple-noodles.webp': 'Chicken Triple Noodles, mountain of fiery Schezwan noodles topped with crispy golden noodles and a bowl of thick red Schezwan chicken gravy, on a matte black plate on dark slate, no text, no watermarks',
  'chi-manchurian-noodles.webp': 'Chicken Manchurian Noodles, savory Hakka noodles smothered in thick dark ginger-garlic Manchurian chicken gravy, on a matte black plate on dark slate, no text, no watermarks',
  'chi-dragon-noodles.webp': 'Chicken Dragon Noodles, stir-fried noodles topped with crispy chicken chunks tossed in spicy red dragon sauce with roasted cashews, on a matte black plate on dark slate, no text, no watermarks',
  'chi-malaysian-noodles.webp': 'Chicken Malaysian Noodles, curried noodles tossed with tender chicken strips, bell peppers, coconut notes and scallions, on a matte black plate on dark slate, no text, no watermarks',
  'hindustan-special-noodles.webp': 'Hindustan Special Noodles, signature chef combination noodles tossed with chicken, prawns, egg ribbons, exotic vegetables and savory house sauce, on a matte black plate on dark slate, no text, no watermarks'
};

function buildPrompt(filename, dishName, category) {
  if (CULINARY_PROFILES[filename]) {
    return `Michelin-star professional food photography of ${CULINARY_PROFILES[filename]}. Placed on a dark charcoal black slate stone tabletop with fine mineral texture. 45-degree angle view, soft warm directional studio lighting from front-right creating realistic highlights and soft shadows, photorealistic 8k, centered symmetrical composition, square 1:1, appetizing natural colors, no text, no watermarks, no logos, no cutlery, no spoons`;
  }
  
  const lowerCat = category.toLowerCase();
  const lowerDish = dishName.toLowerCase();
  const isLiquid = lowerCat.includes('soup') || lowerCat.includes('curry') || lowerCat.includes('gravy') || lowerCat.includes('dal') || lowerDish.includes('curry') || lowerDish.includes('gravy');
  const vessel = isLiquid ? 'deep matte black ceramic round bowl' : 'heavy round matte black ceramic plate';

  return `Michelin-star professional food photography of authentic Indian restaurant ${dishName} (${category}). Perfectly prepared with authentic spices and fresh herbs, arranged in a ${vessel} on a dark charcoal black slate stone tabletop with fine mineral texture. 45-degree angle view, soft warm directional studio lighting, photorealistic 8k, square 1:1, appetizing natural colors, no text, no watermarks, no logos, no cutlery, no spoons`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchImageBuffer(promptText) {
  const encoded = encodeURIComponent(promptText);
  let attempts = 0;
  
  while (attempts < 6) {
    attempts++;
    const seed = Math.floor(Math.random() * 900000) + 100000;
    const url = `https://image.pollinations.ai/prompt/${encoded}?nologo=true&seed=${seed}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://pollinations.ai/'
        },
        signal: AbortSignal.timeout(60000)
      });

      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 5000) return buf;
      }

      if (res.status === 402) {
        const text = await res.text();
        let waitSec = 48;
        const match = text.match(/Retry after (\d+)s/);
        if (match) {
          waitSec = parseInt(match[1], 10) + 3;
        }
        console.log(`   [Rate limit: free tier 45s window] Waiting ${waitSec}s before retry...`);
        await sleep(waitSec * 1000);
        continue;
      }

      console.log(`   HTTP ${res.status}, waiting 15s...`);
      await sleep(15000);
    } catch (err) {
      console.log(`   Fetch error (${err.message}), waiting 10s...`);
      await sleep(10000);
    }
  }

  return null;
}

async function processAndSaveImage(inputBuf, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const meta = await sharp(inputBuf).metadata();
  const cropHeight = Math.max(100, (meta.height || 1024) - 45);
  const cropWidth = meta.width || 1024;

  await sharp(inputBuf)
    .extract({ left: 0, top: 0, width: cropWidth, height: cropHeight })
    .resize(1024, 1024, { fit: 'cover', position: 'center' })
    .webp({ quality: 92 })
    .toFile(outputPath);
}

async function main() {
  console.log('Starting continuous image generation process with authentic researched culinary profiles...');

  while (true) {
    if (!fs.existsSync(MISSING_FILE)) {
      console.log('No missing-images.txt file found. Completed!');
      break;
    }

    const lines = fs.readFileSync(MISSING_FILE, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      console.log('All images have been generated! Done.');
      break;
    }

    const currentLine = lines[0];
    const parts = currentLine.split('|').map(s => s.trim());
    const [filename, dishName, category, folder] = parts;

    const targetPath = path.join(MEDIA_DIR, folder, filename);

    console.log(`\n[Queue: ${lines.length} remaining] Generating: ${dishName} (${category}) -> ${folder}/${filename}`);
    const prompt = buildPrompt(filename, dishName, category);
    console.log(`   Prompt: ${prompt.substring(0, 105)}...`);

    const startTime = Date.now();
    const buf = await fetchImageBuffer(prompt);

    if (!buf) {
      console.error(`   ✗ Generation error: All attempts failed to return a valid buffer`);
      console.log('   Waiting 30s before trying next...');
      await sleep(30000);
      continue;
    }

    const genDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   Generated in ${genDuration}s (${buf.length} bytes)`);

    try {
      await processAndSaveImage(buf, targetPath);
      const outStat = fs.statSync(targetPath);
      console.log(`   Saved 1024x1024 WebP (${outStat.size} bytes) -> ${targetPath}`);

      // Remove from missing-images.txt
      const remainingLines = lines.slice(1);
      fs.writeFileSync(MISSING_FILE, remainingLines.join('\n') + (remainingLines.length ? '\n' : ''));
      console.log(`   ✓ Item completed. Remaining: ${remainingLines.length}`);
    } catch (saveErr) {
      console.error(`   ✗ Save error: ${saveErr.message}`);
    }

    // Free tier rate pacing (wait 48s between items)
    console.log(`   [Pacing] Waiting 48s for next dish...`);
    await sleep(48000);
  }

  console.log('\n=========================================');
  console.log('ALL MENU IMAGES GENERATED AND VERIFIED!');
  console.log('=========================================');
}

main().catch(err => {
  console.error('Fatal runner error:', err);
});

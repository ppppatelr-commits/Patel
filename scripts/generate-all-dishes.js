const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const MENU_DATA = require('./menu-data.json');

const CATEGORY_SLUG_MAP = {
  'CHICKEN SOUPS': 'chicken-soups',
  'VEG SOUPS': 'veg-soups',
  'CHICKEN STARTERS': 'chicken-starters',
  'VEG STARTER': 'veg-starters',
  'TANDOORI CHICKEN STARTER': 'tandoori-chicken-starters',
  'VEG CURRIES': 'veg-curries',
  'PANEER CURRIES': 'paneer-curries',
  'EGG CURRIES': 'egg-curries',
  'TEA AND COLDRINKS': 'beverages',
  'KHICHDA': 'khichda',
  'SEEKH': 'seekh',
  'HINDUSTAN KEEMA': 'hindustan-keema',
  'HINDUSTAN KEBAB': 'hindustan-kebab',
  'SEA FOODS': 'seafood',
  'EXTRA': 'extra',
  'ROTI MEIN': 'roti',
  'VEG CHINESE RICE': 'chinese',
  'VEG CHINESE NOODLES': 'noodles',
  'KEPSA ITEM': 'kepsa',
  'CHICKEN CHINESE RICE WITH GRAVY': 'chinese',
  'CHICKEN CHINESE RICE': 'chinese',
  'CHICKEN CHINESE NOODLES': 'noodles',
  'CHICKEN CHINESE NOODLES WITH GRAVY': 'noodles',
  'HINDUSTAN BIRYANI': 'biryani',
  'HINDUSTAN SPECIAL RICE': 'pulao',
  'CHICKEN CURRIES': 'chicken-curries',
  'MUTTON CURRIES': 'mutton-curries',
  'FISH CURRIES': 'seafood',
};

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function categorySlug(name) {
  const clean = (name || '').trim().toUpperCase();
  if (CATEGORY_SLUG_MAP[clean]) {
    return CATEGORY_SLUG_MAP[clean];
  }
  return slugify(name);
}

function dishFilename(dish) {
  return `${slugify(dish)}.webp`;
}

// Authentic culinary descriptors mapping
const DISH_DETAILS = {
  // SOUPS
  'CHICKEN MANCHOW SOUP': 'dark savory Chinese manchow broth with shredded chicken and finely chopped vegetables crowned with crispy golden fried noodles',
  'CHICKEN SWEET CORN SOUP': 'golden velvety sweet corn soup with whole sweet corn kernels, tender shredded chicken and delicate silky egg ribbon swirls, garnished with scallions',
  'CHICKEN HOT AND SOUR SOUP': 'glossy deep mahogany spicy and sour soup with shredded chicken, wood ear mushrooms, tofu strips and red chilli flecks',
  'CHICKEN LEMON CORIANDER SOUP': 'clear fragrant citrus broth with tender shredded chicken, crushed fresh green coriander leaves and lemon zest',
  'MUTTON SOUP': 'traditional slow-simmered rich golden mutton paya bone broth with tender bone-in mutton cuts and fresh coriander',
  'TOMATO SOUP': 'rich velvety crimson ripe tomato soup with a swirl of fresh heavy cream and golden croutons',
  'VEG MANCHOW SOUP': 'dark savory Chinese vegetable soup with diced carrots, cabbage and scallions, topped with crispy fried noodles',
  'VEG SWEET CORN SOUP': 'golden creamy sweet corn soup with sweet corn kernels, diced carrots and green peas',
  'VEG HOT AND SOUR SOUP': 'glossy spicy vegetable broth with shredded mushrooms, cabbage and green spring onions',
  'VEG LEMON CORIANDER SOUP': 'clear aromatic citrusy vegetable broth with finely chopped green coriander and julienned carrots',

  // CHICKEN STARTERS
  'CHICKEN MANCHURIAN DRY': 'crispy fried chicken bites tossed in glossy dark soya-garlic glaze with chopped spring onions',
  'CHICKEN MANCHURIAN GRAVY': 'succulent chicken meatballs simmered in thick glossy dark brown Manchurian sauce with scallions',
  'CHICKEN CHILLY DRY': 'crispy chicken strips tossed with green capsicum cubes, sliced onions, green chillies and dark soy glaze',
  'CHICKEN CHILLY GRAVY': 'tender chicken pieces in spicy Indo-Chinese chilli gravy with chunks of sautéed bell peppers and onions',
  'CHICKEN LOLLIPOP DRY': 'frenched chicken drumettes fried to deep golden-crimson crust with silver foil handles and spring onions',
  'CHICKEN LOLLIPOP GRAVY': 'crispy chicken drumettes drenched in fiery crimson Schezwan garlic gravy with minced scallions',
  'CHICKEN 65 DRY': 'deep-red fried chicken cubes tempered with crispy fresh curry leaves, whole red chillies and mustard seeds',
  'CHICKEN 65 GRAVY': 'succulent chicken cubes coated in spicy curd-based red gravy with curry leaves and green chillies',
  'CHILLY CHICKEN': 'classic Indo-Chinese chilli chicken with glossy soya sauce glaze, sliced green chillies and bell peppers',
  'CHICKEN STEAM': 'healthy moist steamed chicken breast slices seasoned with ginger and white pepper in light broth',
  'CHICKEN SPRING ROLL': 'golden blistered crispy fried spring rolls sliced diagonally showing savory shredded chicken and cabbage filling',
  'CHICKEN CRISPY': 'shredded chicken fried to ultra-crunchy golden texture tossed with mild Schezwan glaze and crispy noodles',
  'CHICKEN LOLLIPOP': 'frenched chicken wings fried to a crispy golden-brown shell with clean bone handles',

  // VEG STARTERS
  'VEG MANCHURIAN DRY': 'crispy fried vegetable dumplings tossed in aromatic dark soya, garlic and scallion glaze',
  'VEG MANCHURIAN GRAVY': 'vegetable dumplings simmered in rich dark brown Manchurian gravy with green onions',
  'VEG BALLS DRY': 'crispy golden vegetable balls wok-tossed with spring onions, garlic and light soy glaze',
  'VEG BALLS GRAVY': 'savory vegetable balls swimming in thick spicy Indo-Chinese gravy with bell peppers',
  'BABY CORN MANCHURIAN': 'crunchy golden batter-fried baby corn spears coated in glossy Manchurian sauce and scallions',
  'CHILLY PANEER DRY': 'golden-seared fresh cottage cheese paneer cubes tossed with crunchy bell peppers, onions and dark soy glaze',
  'CHILLY PANEER GRAVY': 'soft paneer cubes simmered in spicy thick Indo-Chinese chilli sauce with peppers and onions',
  'PANEER CHILLY': 'wok-tossed paneer cubes with green chillies, red onions and savory soy sauce reduction',
  'MUSHROOM CHILLY': 'juicy button mushrooms wok-tossed with spicy dark soya, garlic and fresh green bell peppers',
  'GOBI MANCHURIAN DRY': 'crisp cauliflower florets coated in spicy reddish-brown batter, tossed with ginger, garlic and spring onions',
  'GOBI MANCHURIAN GRAVY': 'batter-fried cauliflower florets in thick aromatic Manchurian sauce',
  'VEG SPRING ROLL': 'crispy golden rolled pastry filled with sautéed shredded cabbage, carrots and glass noodles',
  'VEG CRISPY': 'crispy batter-fried mixed vegetable shreds tossed in sweet-and-spicy tangy Indo-Chinese sauce',

  // TANDOORI
  'FULL CHICKEN': 'whole tandoori roasted chicken with bright crimson spiced yogurt marinade and authentic clay tandoor grill marks',
  'HALF CHICKEN': 'half tandoori chicken roasted in clay oven with smoky charred edges, seasoned with chaat masala and lime',
  'QUARTER CHICKEN': 'quarter tandoori chicken leg and thigh cut with deep grill marks and vibrant red spiced crust',
  'CHICKEN TIKKA': 'boneless succulent chicken morsels skewered and roasted with red tandoori marinade and smoky char marks',
  'CHICKEN TIKKA MASALA': 'charred tandoori chicken tikka pieces folded into a thick spiced onion-tomato gravy with cream swirl',
  'AFGHANI CHICKEN': 'rich Mughlai tandoori chicken marinated in cashew cream and butter with mild white-golden charred crust',
  'TANGRI KEBAB': 'chicken drumsticks marinated in spicy royal marinade roasted over glowing coals with silver foil handles',
  'MALAI TIKKA': 'tender chicken cubes steeped in fresh cream and hung curd, lightly grilled with subtle golden char highlights',
  'HARA BHARA TIKKA': 'boneless chicken pieces marinated in vibrant spinach, mint and coriander paste roasted in tandoor',
  'SEEKH KEBAB': 'minced meat skewers grilled on long skewers with fine herbs, onions and aromatic spices',

  // CURRIES
  'CHICKEN MASALA': 'tender chicken chunks simmered in rich spiced onion-tomato gravy with garam masala',
  'CHICKEN BUTTER MASALA': 'tender tandoori chicken pieces simmered in silky orange-red makhani butter gravy with cream swirls and melting butter',
  'CHICKEN KADAI': 'chicken curry cooked in iron wok with coarsely ground coriander seeds, dry red chillies and capsicum cubes',
  'CHICKEN JAIPURI': 'royal Rajasthani style chicken curry with creamy cashew-tomato gravy garnished with fried papad curls',
  'CHICKEN KOLHAPURI': 'fiery Maharashtrian chicken curry with deep crimson gravy, roasted coconut and Kolhapuri spices',
  'CHICKEN SHAHIKORMA': 'Moghlai chicken curry in velvety cashew-almond creamy white gravy with saffron aroma',
  'CHICKEN LAJAWAB': 'rich aromatic chicken curry with layered spices, fried onions and fresh cream',
  'CHICKEN CURRY': 'authentic homestyle Indian chicken curry with tender chicken in fragrant onion-tomato gravy',
  'CHICKEN DO PYAZA': 'chicken curry prepared with double quantity of caramelized onions and aromatic spices',
  'CHICKEN BHUNA': 'chicken slow-cooked until dark spicy onion-tomato gravy clings thickly to every succulent cut',
  'CHICKEN ACHARI': 'tangy pickled chicken curry infused with mustard seeds, fenugreek, nigella and fennel spices',
  'CHICKEN METHI': 'chicken curry cooked with fresh green fenugreek leaves (methi) in spiced savory gravy',
  'CHICKEN PALAK': 'succulent chicken pieces simmered in rich vibrant green spinach gravy with garlic tempering',
  'CHICKEN MUTTER': 'chicken curry with tender green peas and ground spices in savory tomato gravy',
  'CHICKEN CHETTINAD': 'South Indian chicken curry bursting with roasted black pepper, star anise and curry leaves',
  'CHICKEN CHILLY GARLIC': 'spicy chicken gravy infused with crushed golden garlic and hot red chillies',

  // MUTTON CURRIES
  'MUTTON MASALA': 'tender mutton chunks slow-cooked in rich dark spiced brown gravy with bone marrow juices',
  'MUTTON BUTTER MASALA': 'tender mutton pieces in creamy spiced tomato-butter gravy with cream swirls',
  'MUTTON TIKKA MASALA': 'grilled mutton chunks simmered in thick spicy onion-tomato masala',
  'MUTTON KADAI': 'succulent mutton pieces simmered in wok with freshly ground spices, bell peppers and ginger',
  'MUTTON JAIPURI': 'rich royal mutton curry with aromatic roasted spices and cashew gravy',
  'MUTTON KOLHAPURI': 'spicy Kolhapuri mutton curry with roasted coconut, red chillies and rich dark gravy',
  'MUTTON SHAHIKORMA': 'tender mutton braised in mild velvety almond-cashew creamy gravy with saffron',
  'MUTTON LAJAWAB': 'flavorful mutton curry slow-braised with caramelized onions and whole garam masala',
  'MUTTON CURRY': 'homestyle traditional mutton curry with tender bone-in mutton in spiced onion gravy',
  'MUTTON DO PYAZA': 'mutton curry with caramelized pearl onions and roasted spices',
  'MUTTON BHUNA': 'rich slow-cooked mutton curry with dry roasted spices and thick clinging brown masala',
  'MUTTON ACHARI': 'tangy spiced mutton curry infused with pickling spices and mustard oil aroma',
  'MUTTON METHI': 'tender mutton slow-cooked with fresh bitter-sweet fenugreek leaves and fragrant spices',
  'MUTTON PALAK': 'mutton pieces simmered in pureed fresh green spinach gravy with garlic and cumin',
  'MUTTON MUTTER': 'tender mutton chunks with green peas in spiced onion-tomato gravy',
  'MUTTON CHETTINAD': 'peppery South Indian mutton curry with roasted spices and curry leaves',
  'MUTTON CHILLY GARLIC': 'spicy mutton curry with browned garlic flakes and crushed red chillies',

  // PANEER CURRIES
  'PANEER LAJAWAB': 'soft paneer cubes in royal rich gravy garnished with grated paneer and cream',
  'PANEER TAWA': 'pan-seared paneer cubes tossed on flat griddle with onions, tomatoes and capsicum',
  'PANEER BHURJI': 'scrambled fresh cottage cheese cooked with onions, tomatoes, green chillies and turmeric',
  'PANEER MASALA': 'fresh paneer cubes cooked in flavorful traditional spiced onion-tomato gravy',
  'PANEER TIKKA MASALA': 'charred grilled paneer tikka cubes simmered in thick spiced creamy tomato gravy',
  'PANEER BUTTER MASALA': 'soft paneer cubes swimming in rich creamy orange-red tomato-butter gravy with cream swirls',
  'PANEER KADAI': 'paneer cubes wok-cooked with chunky bell peppers, onion petals and crushed coriander seeds',
  'PANEER MUTTER': 'classic North Indian curry of soft paneer cubes and sweet green peas in tomato gravy',
  'PANEER PALAK': 'fresh paneer cubes floating in vibrant silky green spinach puree with garlic tempering',
  'PANEER CHATPATA': 'tangy and spicy paneer curry with chaat spices, tomatoes and fresh coriander',
  'PANEER ANGARA': 'smoky fiery red paneer curry infused with live charcoal smoke aroma',
  'PANEER LAZEEZ': 'decadent paneer curry with cashew cream, saffron hints and rich texture',

  // VEG CURRIES
  'VEG KADAI': 'colorful mixed vegetables wok-tossed with coarse spices, bell peppers and tomato gravy',
  'VEG JAIPURI': 'mixed seasonal vegetables in royal Rajasthani cashew-tomato gravy with fried papad',
  'VEG MAKHANWALA': 'mixed vegetables simmered in sweet-savory creamy makhani butter gravy with cream',
  'VEG SHAHI KORMA': 'vegetables braised in mild rich white cashew-coconut creamy gravy with raisins',
  'VEG KOLHAPURI': 'assorted vegetables in fiery dark red Kolhapuri spiced curry with desiccated coconut',
  'MIX VEG': 'homestyle dry-curry of carrots, green beans, peas, potatoes and cauliflower with cumin',
  'ALOO GOBI': 'classic dry potato and cauliflower florets sautéed with turmeric, ginger and cumin',
  'CHANA MASALA': 'plump chickpeas simmered in dark tangy spiced tea-infused onion-tomato gravy with ginger',
  'ALOO MUTTER': 'tender potatoes and green peas in light spiced homestyle tomato curry',
  'ALOO PALAK': 'cubed potatoes simmered in smooth seasoned fresh spinach puree',
  'DAL FRY BUTTER': 'yellow toor dal cooked to perfection with ghee-fried garlic, cumin and generous butter pat',
  'DAL TADKA': 'golden yellow lentils topped with sizzling aromatic tadka of desi ghee, garlic and red chillies',
  'DAL FRY': 'traditional yellow lentil dal tempered with cumin seeds, onions, tomatoes and fresh coriander',
  'VEG CHATPATA': 'tangy spicy medley of fresh vegetables with bold spices and green chillies',

  // BIRYANI & RICE
  'VEG BIRYANI': 'fragrant basmati rice layered with spiced vegetables, saffron milk, fried onions and mint',
  'PANEER BIRYANI': 'dum-cooked basmati rice with grilled spiced paneer cubes, saffron and caramelized onions',
  'EGG BIRYANI': 'aromatic basmati rice layered with golden pan-fried boiled eggs, saffron and fried onions',
  'CHICKEN BIRYANI': 'authentic dum biryani with long-grain saffron basmati rice, tender spiced chicken and fried onions',
  'MUTTON BIRYANI': 'royal kacchi dum biryani with saffron basmati rice, tender bone-in mutton pieces and mint',
  'PRAWNS BIRYANI': 'fragrant coastal basmati rice cooked with plump spiced prawns and caramelized onions',
  'FISH BIRYANI': 'delicate basmati rice layered with spiced fish fillets, saffron and fresh herbs',
  'VEG PULAO': 'fragrant long-grain rice pilaf cooked with green peas, diced carrots, beans and whole spices',
  'PANEER PULAO': 'golden-hued basmati rice pilaf studded with lightly sautéed paneer cubes and green peas',
  'EGG PULAO': 'fragrant basmati rice tossed with hard-boiled egg halves, cumin and mild spices',
  'CHICKEN PULAO': 'mildly spiced aromatic chicken rice pilaf with tender chicken pieces and whole garam masala',
  'MUTTON PULAO': 'savory basmati rice cooked in rich mutton yakhni broth with tender mutton pieces',
  'PRAWNS PULAO': 'fragrant coastal rice pilaf with juicy prawns, coconut milk hints and curry leaves',

  // KEPSA DISHES
  'CHILLY KEPSA HALF': 'fragrant seasoned Kepsa rice platter crowned with Indo-Chinese chilli chicken and toasted nuts',
  'CHILLY KEPSA FULL': 'grand platter of spiced Kepsa rice topped with crispy chilli chicken, fried cashews and raisins',
  'SCHEZWAN KEPSA HALF': 'fiery Schezwan flavored rice bed topped with crisp Schezwan chicken and fried onions',
  'SCHEZWAN KEPS FULL': 'grand Arabian feast platter of Schezwan rice, spicy roasted chicken and toasted nuts with red sauce',
  'ARBI KEPSA HALF': 'Arabian style fragrant spiced rice with tender roasted meat and toasted cashews',
  'ARBI KEPSA FULL': 'luxurious Arabic Kepsa rice platter with whole roasted chicken, almonds, raisins and gravy bowl',
  'CHICKEN KEPSA HALF': 'aromatic seasoned long-grain rice topped with roasted golden chicken pieces and fried cashews',
  'CHICKEN KEPSA FULL': 'majestic feast platter of spiced basmati rice topped with whole roasted tandoori chicken, fried nuts and gravy',
  'MUTTON KEPSA HALF': 'aromatic rice platter topped with slow-roasted tender spiced mutton and toasted almonds',
  'MUTTON KEPSA FULL': 'grand feast platter of fragrant Kepsa rice loaded with tender roasted mutton, cashews and fried onions',
  'MINI KEPSA CHICKEN': 'individual platter of spiced Kepsa rice with a golden roasted chicken cut and toasted nuts',
  'MINI KEPSA MUTTON': 'individual platter of aromatic Kepsa rice served with roasted tender mutton pieces and nuts',
  'MINI PANEER KEPSA': 'spiced rice platter topped with grilled marinated paneer cubes, cashews and raisins',
  'MINI ARBI KEPSA': 'individual aromatic Arabic rice platter with spiced roasted meat and golden nuts',
  'SEHEZWAN MINI KEPSA': 'individual Schezwan seasoned rice platter with crispy Schezwan chicken and spring onions',

  // ROTI MEIN
  'TANDOORI ROTI': 'earthy whole wheat flatbread baked in clay oven with charred blister spots and light butter sheen',
  'BTR ROTI': 'clay-oven baked whole wheat roti brushed with rich melted butter',
  'NAAN': 'classic teardrop-shaped leavened white flatbread baked against clay tandoor wall',
  'BTR NAAN': 'fluffy tandoori naan flatbread generously brushed with golden melted butter',
  'LACHA PARATHA': 'multi-layered spiral flaky wheat paratha pan-crisped with ghee showing golden rings',
  'CHAPATHI': 'thin soft puffed home-style whole wheat round flatbread',
  'SPL CHAPATHI': 'extra soft delicate whole wheat chapati lightly cooked with ghee',
  'CHAPATHI PARATHA': 'pan-fried layered wheat paratha with golden toasted spots',
  'BTR GARLIC NAAN': 'fluffy tandoori naan encrusted with minced golden roasted garlic and fresh green coriander with butter',
  'BUTTER CHAPATI': 'warm puffed soft whole wheat chapati brushed with pure butter',

  // KEEMA & KEBAB
  'SPL KEEMA': 'rich spiced minced mutton keema cooked with onions, tomatoes, ginger juliennes and fresh mint',
  'SPL KEEMA FRY': 'minced mutton keema pan-fried on high heat with whole spices, green chillies and fresh coriander',
  'SADA KEEMA': 'homestyle spiced minced meat cooked with mild garam masala and green peas',
  'SADA KEEMA FRY': 'pan-seared minced meat keema with onions and green chillies',
  'KEEMA GHOTALA': 'spiced minced mutton scrambled together with eggs, tomatoes and green chillies',
  'SPL KEEMA GHOTALA': 'royal minced mutton keema folded with scrambled eggs, butter and fresh coriander',
  'SPECIAL FULL KEEMA': 'large portion of dark spicy slow-cooked minced mutton keema with ginger and mint',
  'SADA KEEMA FULL': 'hearty portion of homestyle minced meat curry seasoned with cumin and coriander',
  'SPL KEEMA PULAO': 'fragrant basmati rice pilaf cooked with rich spiced minced mutton keema and caramelized onions',
  'SADA KEEMA PULAO': 'savory basmati rice pilaf layered with seasoned minced meat and mild spices',
  'SPL KEEMA FRIED RICE': 'wok-tossed long grain rice with spicy minced mutton keema, spring onions and soya',
  'HINDUSTAN KEBAB 12PCS': 'platter of 12 bite-sized crispy spiced fried kebabs with mint chutney and lemon wedges',
  'HINDUSTAN KEBAB 6PCS': 'platter of 6 crispy golden-brown spiced minced kebabs with onion rings',
  'EGG KEBAB 12PCS': '12 spiced boiled egg kebabs coated in crispy golden batter with chutney',
  'DOUBLE EGG KEBAB 12PCS': '12 double-layered egg kebabs fried with savory spiced crust and coriander',
  'DOUBLE EGG KEBAB 6PCS': '6 golden-fried double egg kebabs with crispy outer layer and mint dip',
  'EGG KEBAB 6PCS': '6 delicious spiced egg kebabs fried golden-crisp with sliced onions',

  // CHINESE RICE & NOODLES
  'VEG FRIED RICE': 'wok-tossed long-grain rice with finely diced carrots, beans, spring onions and light soy',
  'VEG SCHEZWAN FRIED RICE': 'fiery orange-red wok-fried rice tossed with spicy Schezwan sauce, cabbage and scallions',
  'VEG MANCHURIAN FRIED RICE': 'fried rice topped with savory vegetable Manchurian balls in rich dark soya gravy',
  'VEG SINGAPORE FRIED RICE': 'fragrant yellow wok-tossed rice with mild curry powder hints, bell peppers and spring onions',
  'VEG HONG KONG FRIED RICE': 'flavorful fried rice with diced vegetables and mild sweet-savory Hong Kong style seasoning',
  'VEG CHILLY FRIED RICE': 'spicy wok-fried rice with sliced green chillies, garlic and bell peppers',
  'EGG SEZ. FRIED RICE': 'scrambled egg wok-tossed with spicy Schezwan rice and green scallions',
  'VEG HAKKA NOODLES': 'long silky wok-tossed hakka noodles with julienned carrots, bell peppers, cabbage and scallions',
  'VEG SCHEZWAN NOODLES': 'spicy red wok-tossed noodles coated in fiery Schezwan chilli paste and crisp vegetables',
  'VEG SINGAPORE NOODLES': 'thin rice noodles tossed with vegetables, mild yellow curry seasoning and scallions',
  'VEG HONG KONG NOODLES': 'stir-fried noodles with crunchy vegetable strips in savory soya-garlic glaze',
  'VEG MANCHURIAN NOODLES': 'noodles served with crisp vegetable Manchurian balls in dark savory gravy',
  'VEG CHILLY NOODLES': 'spicy noodles wok-fried with sliced fresh green chillies, garlic and bell peppers',
  'EGG SEZ. NOODLES': 'wok-tossed noodles with scrambled egg ribbons, spicy Schezwan paste and spring onions',
  'CHI. CHILLY RICE': 'wok-fried rice served with spicy Indo-Chinese chilli chicken and rich glossy gravy',
  'CHI. TRIPLE RICE': 'legendary Mumbai triple rice featuring fried rice, hakka noodles, crispy fried noodles and chicken Schezwan gravy',
  'CHI. MANCHURIAN RICE': 'fried rice served with tender chicken Manchurian meatballs in savory dark gravy',
  'CHI. DRAGON RICE': 'spicy fried rice topped with fiery Dragon chicken strips and red chillies',
  'CHI. CHOPPER RICE': 'wok-fried rice topped with finely chopped spicy chicken and rich Manchurian gravy',
  'CHI. MALAYSIAN RICE': 'rich spiced Malaysian style chicken fried rice with cashew nuts and sweet-spicy glaze',
  'CHI. BUTTER RICE': 'aromatic rice tossed with tender butter chicken pieces and mild savory seasoning',
  'HINDUSTAN SPECIAL FRIED RICE': 'chef signature grand platter of wok-fried rice loaded with chicken, prawns, egg and spring onions',
  'CHI. POT RICE': 'savory clay-pot style rice topped with rich chicken and vegetable gravy in dark soya reduction',
  'CHI. FRIED RICE': 'classic wok-tossed long-grain rice with tender shredded chicken, egg and scallions',
  'CHI. SCHEZWAN FRIED RICE': 'spicy orange-red wok-fried rice with shredded chicken and fiery Schezwan sauce',
  'CHI. SINGAPORE FRIED RICE': 'flavorful chicken fried rice with mild curry powder and bell peppers',
  'CHI. HONG KONG FRIED RICE': 'stir-fried chicken rice with sweet-savory dark soy sauce and scallions',
  'CHI. MIXED FRIED RICE': 'grand fried rice loaded with chicken, scrambled egg and fresh vegetables',
  'COMBIN. FRIED RICE': 'combination fried rice tossed with chicken, mutton, egg and prawns',
  'CHI. HAKKA NOODLES': 'silky wok-tossed noodles with shredded chicken, julienned cabbage, carrots and spring onions',
  'CHI. SCHEZWAN NOODLES': 'fiery red noodles with chicken strips, Schezwan chilli garlic paste and scallions',
  'CHI. HONG KONG NOODLES': 'wok-fried chicken noodles with savory soya glaze and crisp vegetables',
  'CHI. SINGAPORE NOODLES': 'thin noodles tossed with chicken shreds, yellow curry hints and bell peppers',
  'MIX NOODLES': 'deluxe noodles wok-tossed with chicken, prawns, egg and seasonal vegetables',
  'CHI. AMERICAN CHOPSEY': 'nest of ultra-crispy fried noodles topped with sweet and sour chicken and vegetable gravy with fried egg',
  'CHI. CHILLY NOODLES': 'noodles tossed with spicy Indo-Chinese chilli chicken and dark soy sauce',
  'CHI. TRIPLE NOODLES': 'Mumbai style triple noodles with soft noodles, crispy noodles and chicken Schezwan gravy',
  'CHI. MANCHURIAN NOODLES': 'noodles served with succulent chicken Manchurian in rich savory sauce',
  'CHI. DRAGON NOODLES': 'fiery noodles topped with crispy Dragon chicken and red bell peppers',
  'CHI. MALAYSIA NOODLES': 'Malaysian style spiced chicken noodles with rich sweet-savory sauce',
  'HINDUSTAN SPECIAL NOODLES': 'signature grand platter of noodles loaded with chicken, egg and prawns in chef special sauce',

  // SEAFOOD
  'PRAWNS FRIED RICE': 'wok-tossed long grain rice studded with tender pink prawns, scrambled egg and spring onions',
  'PRAWNS SEZ. FRIED RICE': 'spicy Schezwan wok-fried rice loaded with juicy prawns and scallions',
  'PRAWNS SEZ. NOODLES': 'fiery Schezwan noodles wok-tossed with fresh pink prawns and crisp vegetables',
  'PRAWNS PULAV': 'coastal fragrant rice pilaf cooked with sweet succulent prawns, coconut milk and spices',
  'PRAWNS MASALA': 'plump fresh prawns cooked in thick spicy coastal onion-tomato gravy with kokum and coriander',
  'PRAWNS PLAIN FRY': 'golden pan-fried fresh prawns marinated with turmeric, red chilli and lemon juice',
  'PRAWNS CHILLY': 'succulent prawns wok-tossed with green capsicum, onions, slit green chillies and soya glaze',
  'PRAWNS CHILLY DRY': 'crispy batter-fried prawns tossed in spicy dry chilli garlic sauce with spring onions',
  'FISH MASALA': 'tender pieces of fresh fish simmered in rich spicy onion-tomato gravy with curry leaves',
  'FISH CURRY': 'traditional coastal fish curry with fresh fish fillets in aromatic coconut-tomato gravy',
  'FISH TIKKA MASALA': 'grilled tandoori fish tikka pieces simmered in thick spiced creamy tomato gravy',
  'FISH KADAI': 'succulent fish pieces wok-cooked with coarse spices, bell peppers and onions',
  'FISH BHUNA': 'fish fillets slow-cooked with roasted spices in thick clinging dark masala',
  'FISH DO PYAZA': 'fish curry prepared with caramelized onions and whole spices',
  'FISH PALAK': 'fresh fish fillets poached in rich seasoned green spinach gravy',
  'FISH METHI': 'fish curry cooked with fresh fenugreek leaves in savory spiced gravy',
  'FISH CHILLY': 'crispy fried fish cubes tossed in spicy Indo-Chinese chilli sauce with capsicum',
  'FISH CHILLY GARLIC': 'pan-seared fish in fiery garlic and red chilli sauce with spring onions',

  // BEVERAGES & EXTRAS
  'TEA': 'traditional Indian cutting chai brewed with milk, crushed cardamom and ginger in a glass',
  'SPL TEA': 'rich creamy royal masala chai brewed with saffron, cardamom and ginger',
  'COLDRINKS 500ML': 'chilled bottled soft drink served with ice cubes and condensation droplets',
  'MINERAL WATER BIG': 'crystal clear mineral water bottle with condensation droplets on slate',
  'COLD DRINKS': 'chilled carbonated soft drink served in glass with fizz and ice cubes',
  'JEERA MASALA SODA': 'refreshing fizzy Indian spiced cumin soda with mint and lemon slice',
  'EXTRA SCHEZWAN CHATNI': 'small matte-black dipping bowl filled with fiery red Schezwan garlic chutney',
  'EXTRA GREEN CHATNI': 'small matte-black dipping bowl of fresh vibrant green mint-coriander chutney',
  'EXTRA TOMATO SAUCE': 'small matte-black dipping bowl of smooth glossy crimson tomato sauce',
  'EXTRA FRY NOODLES': 'crispy golden fried noodles in a small matte-black bowl'
};

function getDishDescription(dishName, categoryName) {
  const norm = dishName.toUpperCase().trim();
  if (DISH_DETAILS[norm]) return DISH_DETAILS[norm];

  for (const [k, v] of Object.entries(DISH_DETAILS)) {
    if (norm.includes(k) || k.includes(norm)) return v;
  }

  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('soup')) return 'steaming hot authentic restaurant soup with balanced broth and fresh garnishes';
  if (cat.includes('biryani')) return 'fragrant dum-cooked saffron basmati rice layered with aromatic spices and caramelized onions';
  if (cat.includes('curry')) return 'rich flavorful authentic Indian curry in a thick spiced gravy with fresh coriander';
  if (cat.includes('roti') || cat.includes('naan')) return 'freshly baked flatbread with golden toasted spots and light butter glaze';
  if (cat.includes('chinese')) return 'wok-tossed Indo-Chinese preparation with crisp vegetables and savory glaze';
  if (cat.includes('starter') || cat.includes('tandoori')) return 'crispy spiced appetizer garnished with sliced onions and lime';

  return 'authentic Indian restaurant dish prepared with aromatic spices and professional presentation';
}

function buildPrompt(dishName, categoryName) {
  const cat = (categoryName || '').toLowerCase();
  const isSoupOrCurry = cat.includes('soup') || cat.includes('curry') || cat.includes('gravy') || dishName.toLowerCase().includes('soup');
  const vessel = isSoupOrCurry
    ? 'deep matte-black ceramic round bowl with smooth satin finish'
    : 'heavy matte-black ceramic round platter with smooth rim';

  const desc = getDishDescription(dishName, categoryName);

  return `commercial food photography of single authentic Indian ${dishName}, ${desc}, served in a ${vessel} centered in middle of frame, on dark charcoal slate stone tabletop with fine natural mineral grain, 45 degree high angle view, soft warm directional studio lighting from front right, scattered whole black peppercorns on dark slate, fresh green cilantro, centered symmetrical composition, square 1:1, photorealistic, no text, no watermarks, no cutlery, no spoons`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Build list of URLs to try in order (fallbacks if one fails/rate-limits)
function buildUrls(promptText) {
  const encodedPrompt = encodeURIComponent(promptText);
  const seed = Math.floor(Math.random() * 900000) + 100000;
  return [
    // Primary: Pollinations flux (confirmed free)
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`,
    // Fallback 1: Pollinations flux with different seed
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&model=flux&nologo=true&seed=${seed + 1}`,
    // Fallback 2: Pollinations with no model param (uses default free model)
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed + 2}`,
  ];
}

async function fetchImageBuffer(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/webp,image/png,image/jpeg,image/*',
    },
    signal: AbortSignal.timeout(120000), // 2 min timeout
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length < 5000) throw new Error(`Buffer too small (${buffer.length} bytes)`);
  return buffer;
}

async function generateDish(dishName, categoryName, options = {}) {
  const catSlug = categorySlug(categoryName);
  const filename = dishFilename(dishName);
  const destDir = path.join(process.cwd(), 'public', 'media', 'dishes', catSlug);
  const destFile = path.join(destDir, filename);

  // If already exists and not forced, skip!
  if (fs.existsSync(destFile) && !options.force) {
    return { ok: true, skipped: true, path: destFile, dish: dishName, category: categoryName };
  }

  fs.mkdirSync(destDir, { recursive: true });

  const promptText = buildPrompt(dishName, categoryName);
  const urls = buildUrls(promptText);

  let lastErr = null;
  for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
    const url = urls[urlIdx];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const buffer = await fetchImageBuffer(url);

        // Check dimensions
        const meta = await sharp(buffer).metadata();
        const w = meta.width || 768;
        const h = meta.height || 768;

        // Crop bottom 45px to eliminate watermark, then scale to 1024x1024 WebP
        const cropHeight = Math.max(100, h - 45);
        await sharp(buffer)
          .extract({ left: 0, top: 0, width: w, height: cropHeight })
          .resize(1024, 1024, { fit: 'cover' })
          .webp({ quality: 90 })
          .toFile(destFile);

        return { ok: true, skipped: false, path: destFile, dish: dishName, category: categoryName };
      } catch (err) {
        lastErr = err;
        // If 402 or rate limit, wait longer before retry/next url
        const wait = err.message.includes('402') ? 8000 : 3000;
        if (attempt < 2) await sleep(wait);
      }
    }
    // Wait between URL fallbacks
    if (urlIdx < urls.length - 1) await sleep(5000);
  }
  return { ok: false, error: lastErr ? lastErr.message : 'All URLs failed', dish: dishName, category: categoryName };
}

async function main() {
  const args = process.argv.slice(2);
  const targetCategory = args[0]; // optional category filter

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('HINDUSTAN RESTAURANT — FULL AI FOOD PHOTOGRAPHY BATCH GENERATOR');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  const itemsRecord = MENU_DATA.items;
  let allDishes = [];

  for (const [catName, catItems] of Object.entries(itemsRecord)) {
    if (targetCategory && catName.toUpperCase() !== targetCategory.toUpperCase()) {
      continue;
    }
    for (const it of catItems) {
      allDishes.push({ dish: it.name, category: catName, price: it.price });
    }
  }

  console.log(`Target: ${allDishes.length} dishes to process.\n`);

  let countSuccess = 0;
  let countSkipped = 0;
  let countFailed = 0;

  for (let i = 0; i < allDishes.length; i++) {
    const item = allDishes[i];
    process.stdout.write(`[${i + 1}/${allDishes.length}] ${item.dish} (${item.category})... `);

    const result = await generateDish(item.dish, item.category);

    if (result.skipped) {
      console.log('SKIPPED (already exists)');
      countSkipped++;
    } else if (result.ok) {
      console.log('DONE ✓');
      countSuccess++;
    } else {
      console.log(`FAILED ✗ (${result.error})`);
      countFailed++;
    }

    // Small delay between requests
    if (!result.skipped) {
      await sleep(1500);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`SUMMARY: ${countSuccess} generated, ${countSkipped} skipped, ${countFailed} failed.`);
  console.log('══════════════════════════════════════════════════════════════════════');
}

main().catch(console.error);

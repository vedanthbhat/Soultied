import { AvatarConfig } from '../types';

export interface SkinPalette {
  id: string;
  name: string;
  base: string;
  shadow: string;
  blush: string;
}

export interface HairPalette {
  id: string;
  name: string;
  base: string;
  highlight: string;
  shadow: string;
}

export interface WardrobeItem {
  id: string;
  name: string;
  category: 'tops' | 'bottoms' | 'shoes' | 'glasses' | 'hats' | 'accessories';
  primaryColor: string;
  description: string;
}

export const SKIN_PALETTES: SkinPalette[] = [
  { id: 'skin-1', name: 'Warm Cream', base: '#F4D8C6', shadow: '#D6AE96', blush: '#E5989B' },
  { id: 'skin-2', name: 'Warm Peach', base: '#EDB795', shadow: '#C88D68', blush: '#C56D76' },
  { id: 'skin-3', name: 'Warm Tan', base: '#D99B6A', shadow: '#AB6E42', blush: '#B35552' },
  { id: 'skin-4', name: 'Golden Chestnut', base: '#A86A41', shadow: '#7F4522', blush: '#8F3E3B' },
  { id: 'skin-5', name: 'Deep Cocoa', base: '#704229', shadow: '#4D2B17', blush: '#5E2625' },
  { id: 'skin-6', name: 'Rich Espresso', base: '#4A2A1A', shadow: '#31180C', blush: '#3D1515' },
];

export const HAIR_PALETTES: HairPalette[] = [
  { id: 'dark-cocoa', name: 'Dark Cocoa', base: '#3A2E2B', highlight: '#55423E', shadow: '#251C1A' },
  { id: 'espresso-black', name: 'Espresso Black', base: '#23201F', highlight: '#3D3836', shadow: '#151312' },
  { id: 'chestnut-brown', name: 'Chestnut Brown', base: '#5D3B2E', highlight: '#7D5140', shadow: '#42271D' },
  { id: 'warm-auburn', name: 'Warm Auburn', base: '#87422E', highlight: '#AB583F', shadow: '#612D1D' },
  { id: 'honey-blonde', name: 'Honey Blonde', base: '#CCA35C', highlight: '#E3BF78', shadow: '#9E7836' },
  { id: 'silver-grey', name: 'Silver Grey', base: '#9FA5A9', highlight: '#BDC2C5', shadow: '#747B80' },
];

export const HAIR_STYLES = [
  { id: 'short-wavy', name: 'Short Wavy (Lead A)', description: 'Textured parted curls' },
  { id: 'shoulder-wave', name: 'Shoulder Wave (Lead B)', description: 'Flowing natural waves' },
  { id: 'curly-coils', name: 'Short Curly Coils', description: 'Coiled afro crop' },
  { id: 'bob-part', name: 'Cozy Bob', description: 'Chin-length sleek bob' },
  { id: 'hijab-wrap', name: 'Warm Hijab Wrap', description: 'Soft draped headscarf' },
  { id: 'silver-bun', name: 'High Soft Bun', description: 'Casual rounded bun' },
  { id: 'clean-crop', name: 'Clean Crop', description: 'Neat short taper' },
  { id: 'bald', name: 'Natural / Bald', description: 'No hair' },
];

export const TOPS: WardrobeItem[] = [
  { id: 'terracotta-cardigan', name: 'Terracotta Cardigan', category: 'tops', primaryColor: '#BD725D', description: 'Open cozy knit with cream tee' },
  { id: 'sage-sweater', name: 'Sage Ribbed Sweater', category: 'tops', primaryColor: '#8C9B75', description: 'Crewneck chunky knit' },
  { id: 'lavender-hoodie', name: 'Lavender Fleece Hoodie', category: 'tops', primaryColor: '#A89BAF', description: 'Relaxed pouch pocket hoodie' },
  { id: 'cream-shirt', name: 'Cream Linen Shirt', category: 'tops', primaryColor: '#F2E8D7', description: 'Buttoned casual collared shirt' },
  { id: 'fair-isle-sweater', name: 'Nordic Pattern Knit', category: 'tops', primaryColor: '#5B7A68', description: 'Sage wool with cream geometric band' },
];

export const BOTTOMS: WardrobeItem[] = [
  { id: 'cocoa-trousers', name: 'Cocoa Relaxed Trousers', category: 'bottoms', primaryColor: '#5B4339', description: 'Tailored easy-fit pleated trousers' },
  { id: 'terracotta-skirt', name: 'Terracotta A-Line Skirt', category: 'bottoms', primaryColor: '#BD725D', description: 'Midi pleated flowy skirt' },
  { id: 'dark-denim', name: 'Indigo Dark Jeans', category: 'bottoms', primaryColor: '#3B4D61', description: 'Classic cuffed straight-leg denim' },
  { id: 'lavender-culottes', name: 'Lilac Wide Trousers', category: 'bottoms', primaryColor: '#9C8DA6', description: 'Pastel breezy lounge pants' },
];

export const SHOES: WardrobeItem[] = [
  { id: 'cream-sneakers', name: 'Cream Retro Sneakers', category: 'shoes', primaryColor: '#F5EFE6', description: 'Everyday comfortable low tops' },
  { id: 'brown-boots', name: 'Chestnut Leather Boots', category: 'shoes', primaryColor: '#6B422B', description: 'Ankle workwear lace boots' },
  { id: 'dark-loafers', name: 'Cocoa Slip-on Loafers', category: 'shoes', primaryColor: '#3D281E', description: 'Polished cozy casual flats' },
];

export const GLASSES: WardrobeItem[] = [
  { id: 'none', name: 'None', category: 'glasses', primaryColor: 'transparent', description: 'No eyewear' },
  { id: 'round-cocoa', name: 'Round Cocoa Frames', category: 'glasses', primaryColor: '#4A352F', description: 'Classic vintage circular glasses' },
  { id: 'gold-wire', name: 'Gold Minimal Wire', category: 'glasses', primaryColor: '#C4A052', description: 'Slim lightweight oval rims' },
];

export const HATS: WardrobeItem[] = [
  { id: 'none', name: 'None', category: 'hats', primaryColor: 'transparent', description: 'No hat' },
  { id: 'butter-beanie', name: 'Butter Ribbed Beanie', category: 'hats', primaryColor: '#E4BB6B', description: 'Warm slouchy knit cap' },
  { id: 'sage-cap', name: 'Sage Baseball Cap', category: 'hats', primaryColor: '#788961', description: 'Curved visor casual cotton cap' },
];

export const ACCESSORIES: WardrobeItem[] = [
  { id: 'none', name: 'None', category: 'accessories', primaryColor: 'transparent', description: 'No extra accessory' },
  { id: 'red-scarf', name: 'Terracotta Knit Scarf', category: 'accessories', primaryColor: '#A84F4B', description: 'Warm wrapped thread-red scarf' },
  { id: 'gold-hoops', name: 'Tiny Gold Hoops', category: 'accessories', primaryColor: '#D4AF37', description: 'Subtle metallic ear loops' },
];

export const STARTER_PRESET_A: AvatarConfig = {
  rendererVersion: 1,
  bodyPreset: 'medium',
  skinPaletteId: 'skin-3',
  hairStyleId: 'short-wavy',
  hairPaletteId: 'dark-cocoa',
  topId: 'terracotta-cardigan',
  bottomId: 'cocoa-trousers',
  shoesId: 'cream-sneakers',
  glassesId: 'none',
  hatId: 'none',
  accessoryId: 'none',
};

export const STARTER_PRESET_B: AvatarConfig = {
  rendererVersion: 1,
  bodyPreset: 'medium',
  skinPaletteId: 'skin-3',
  hairStyleId: 'shoulder-wave',
  hairPaletteId: 'dark-cocoa',
  topId: 'sage-sweater',
  bottomId: 'cocoa-trousers',
  shoesId: 'cream-sneakers',
  glassesId: 'none',
  hatId: 'none',
  accessoryId: 'none',
};

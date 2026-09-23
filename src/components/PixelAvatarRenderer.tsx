import React, { useEffect, useRef } from 'react';
import { AvatarConfig } from '../types';
import { SKIN_PALETTES, HAIR_PALETTES } from '../data/wardrobeCatalogue';

interface PixelAvatarProps {
  config: AvatarConfig;
  size?: number; // visual display height in px (e.g. 120, 160, 240)
  animate?: boolean;
  className?: string;
  flipped?: boolean;
}

export const PixelAvatarRenderer: React.FC<PixelAvatarProps> = ({
  config,
  size = 180,
  animate = true,
  className = '',
  flipped = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 48 x 64 logical pixel grid
    const W = 48;
    const H = 64;
    canvas.width = W;
    canvas.height = H;

    // Reset and disable image smoothing for razor sharp pixels
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    // Helper: draw single logical pixel
    const p = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    };

    // Helper: draw rectangular block of pixels
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    };

    // Resolve palettes
    const skin = SKIN_PALETTES.find((s) => s.id === config.skinPaletteId) || SKIN_PALETTES[2];
    const hair = HAIR_PALETTES.find((h) => h.id === config.hairPaletteId) || HAIR_PALETTES[0];

    // Height offset: short (-2), medium (0), tall (+2)
    // Feet always firmly anchored at y=60
    const hDelta = config.bodyPreset === 'short' ? -2 : config.bodyPreset === 'tall' ? 2 : 0;
    const headY = 12 - hDelta;
    const neckY = headY + 16;
    const waistY = 38;
    const feetY = 58;

    // 1. BACK HAIR (drawn behind body)
    if (config.hairStyleId === 'shoulder-wave') {
      rect(12, headY + 6, 24, 18, hair.shadow);
      rect(13, headY + 7, 22, 16, hair.base);
      rect(11, headY + 10, 4, 15, hair.base);
      rect(33, headY + 10, 4, 15, hair.base);
      // highlights on shoulders
      rect(12, headY + 12, 2, 8, hair.highlight);
      rect(34, headY + 12, 2, 8, hair.highlight);
    } else if (config.hairStyleId === 'hijab-wrap') {
      // Undercap / back drape
      rect(12, headY + 4, 24, 22, '#BD725D');
      rect(11, headY + 12, 26, 12, '#9E5B4B');
    }

    // 2. LEGS / PANTS & SKIRTS
    const legLeftX = 18;
    const legRightX = 26;
    const legW = 4;
    const legH = feetY - waistY;

    if (config.bottomId === 'terracotta-skirt') {
      // Flared pleated skirt
      const skirtColor = '#BD725D';
      const pleatShadow = '#9E5B4B';
      for (let r = 0; r < 12; r++) {
        const spread = Math.floor(r * 0.7);
        rect(17 - spread, waistY + r, 14 + spread * 2, 1, skirtColor);
        if (r > 3) {
          p(20 - spread / 2, waistY + r, pleatShadow);
          p(24, waistY + r, pleatShadow);
          p(28 + spread / 2, waistY + r, pleatShadow);
        }
      }
      // Bare legs below skirt
      rect(legLeftX + 1, waistY + 12, 3, legH - 12, skin.base);
      rect(legRightX, waistY + 12, 3, legH - 12, skin.base);
    } else {
      // Trousers / Jeans
      let pantColor = '#5B4339'; // cocoa
      let pantShadow = '#412F28';
      if (config.bottomId === 'dark-denim') {
        pantColor = '#3B4D61';
        pantShadow = '#273442';
      } else if (config.bottomId === 'lavender-culottes') {
        pantColor = '#9C8DA6';
        pantShadow = '#7E7087';
      }

      // Left leg
      rect(legLeftX - 1, waistY, legW + 2, legH, pantColor);
      rect(legLeftX + legW, waistY + 2, 1, legH - 2, pantShadow);
      // Right leg
      rect(legRightX - 1, waistY, legW + 2, legH, pantColor);
      rect(legRightX - 1, waistY + 2, 1, legH - 2, pantShadow);
      // Crotch connector
      rect(legLeftX + 2, waistY, 8, 3, pantColor);
    }

    // 3. SHOES
    const shoeY = feetY;
    if (config.shoesId === 'brown-boots') {
      const bootBase = '#5A3723';
      const bootSole = '#351F13';
      // Left boot
      rect(16, shoeY - 1, 6, 4, bootBase);
      rect(15, shoeY + 2, 7, 1, bootSole);
      // Right boot
      rect(26, shoeY - 1, 6, 4, bootBase);
      rect(26, shoeY + 2, 7, 1, bootSole);
    } else if (config.shoesId === 'dark-loafers') {
      const loafBase = '#3D281E';
      rect(16, shoeY, 6, 2, loafBase);
      rect(15, shoeY + 2, 7, 1, '#22150F');
      rect(26, shoeY, 6, 2, loafBase);
      rect(26, shoeY + 2, 7, 1, '#22150F');
    } else {
      // Cream sneakers (default)
      const snkBase = '#F5EFE6';
      const snkToe = '#EDE2D3';
      const snkSole = '#483B36';
      // Left sneaker
      rect(16, shoeY, 6, 2, snkBase);
      rect(15, shoeY + 1, 2, 1, snkToe);
      rect(15, shoeY + 2, 7, 1, snkSole);
      // Right sneaker
      rect(26, shoeY, 6, 2, snkBase);
      rect(31, shoeY + 1, 2, 1, snkToe);
      rect(26, shoeY + 2, 7, 1, snkSole);
    }

    // 4. TORSO / TOPS
    const torsoTop = neckY + 2;
    const torsoH = waistY - torsoTop + 1;

    if (config.topId === 'terracotta-cardigan') {
      const cardiColor = '#BD725D';
      const cardiShadow = '#9E5B4B';
      const teeColor = '#F7EBD4';

      // Inner cream T-shirt
      rect(19, torsoTop, 10, torsoH, teeColor);
      p(23, torsoTop + 2, '#DFD3BC');
      p(24, torsoTop + 2, '#DFD3BC');

      // Cardigan body sides
      rect(15, torsoTop, 5, torsoH, cardiColor);
      rect(28, torsoTop, 5, torsoH, cardiColor);
      // Cardigan trim/shadow
      rect(19, torsoTop, 1, torsoH, cardiShadow);
      rect(28, torsoTop, 1, torsoH, cardiShadow);
      // Small buttons
      p(19, torsoTop + 4, '#5C2D24');
      p(19, torsoTop + 8, '#5C2D24');
      // Sleeves
      rect(12, torsoTop + 1, 4, torsoH - 1, cardiColor);
      rect(32, torsoTop + 1, 4, torsoH - 1, cardiColor);
      // Sleeve cuffs
      rect(12, torsoTop + torsoH - 1, 4, 1, cardiShadow);
      rect(32, torsoTop + torsoH - 1, 4, 1, cardiShadow);
    } else if (config.topId === 'sage-sweater') {
      const swColor = '#8C9B75';
      const swShadow = '#6B7A55';
      const swHigh = '#A3B28C';

      rect(15, torsoTop, 18, torsoH, swColor);
      // Ribbed collar
      rect(18, torsoTop - 1, 12, 2, swHigh);
      rect(18, torsoTop, 12, 1, swShadow);
      // Ribbed bottom band
      rect(15, torsoTop + torsoH - 2, 18, 2, swShadow);
      // Sleeves
      rect(12, torsoTop + 1, 4, torsoH - 1, swColor);
      rect(32, torsoTop + 1, 4, torsoH - 1, swColor);
      rect(12, torsoTop + torsoH - 1, 4, 1, swShadow);
      rect(32, torsoTop + torsoH - 1, 4, 1, swShadow);
    } else if (config.topId === 'lavender-hoodie') {
      const hoodColor = '#A89BAF';
      const hoodShadow = '#8C7E94';
      const hoodHigh = '#BFB4C6';

      rect(15, torsoTop, 18, torsoH, hoodColor);
      // Hood roll around neck
      rect(17, torsoTop - 1, 14, 2, hoodHigh);
      // Pouch pocket
      rect(18, torsoTop + 6, 12, 4, hoodShadow);
      // Sleeves
      rect(12, torsoTop + 1, 4, torsoH - 1, hoodColor);
      rect(32, torsoTop + 1, 4, torsoH - 1, hoodColor);
    } else if (config.topId === 'fair-isle-sweater') {
      const baseSw = '#5B7A68';
      const patternColor = '#F7EBD4';
      rect(15, torsoTop, 18, torsoH, baseSw);
      // Nordic geometric band
      rect(15, torsoTop + 3, 18, 3, '#4A6555');
      for (let x = 16; x < 32; x += 3) {
        p(x, torsoTop + 3, patternColor);
        p(x + 1, torsoTop + 4, patternColor);
        p(x, torsoTop + 5, patternColor);
      }
      rect(12, torsoTop + 1, 4, torsoH - 1, baseSw);
      rect(32, torsoTop + 1, 4, torsoH - 1, baseSw);
    } else {
      // Cream linen shirt (default)
      const shirtBase = '#F2E8D7';
      const shirtShadow = '#D8CBB6';
      rect(15, torsoTop, 18, torsoH, shirtBase);
      // Collar wings
      rect(18, torsoTop - 1, 4, 2, shirtShadow);
      rect(26, torsoTop - 1, 4, 2, shirtShadow);
      // Center buttons
      rect(23, torsoTop, 2, torsoH, shirtShadow);
      p(24, torsoTop + 3, '#7E6B56');
      p(24, torsoTop + 7, '#7E6B56');
      // Pocket
      rect(27, torsoTop + 4, 3, 3, shirtShadow);
      // Sleeves
      rect(12, torsoTop + 1, 4, torsoH - 1, shirtBase);
      rect(32, torsoTop + 1, 4, torsoH - 1, shirtBase);
    }

    // Hands peeking out of sleeves
    rect(13, torsoTop + torsoH, 3, 3, skin.base);
    rect(32, torsoTop + torsoH, 3, 3, skin.base);

    // 5. NECK
    rect(22, headY + 15, 4, 3, skin.shadow);

    // 6. HEAD & FACE
    // Main head rounded rectangle (approx 20 x 16)
    rect(15, headY, 18, 15, skin.base);
    // Soft round corners
    p(14, headY + 2, skin.base);
    p(14, headY + 3, skin.base);
    p(33, headY + 2, skin.base);
    p(33, headY + 3, skin.base);
    // Jaw shadow
    rect(16, headY + 14, 16, 1, skin.shadow);

    // Ears
    rect(13, headY + 7, 2, 4, skin.base);
    rect(33, headY + 7, 2, 4, skin.base);
    p(14, headY + 8, skin.shadow);
    p(33, headY + 8, skin.shadow);

    // Cute dot eyes (2x2 or 2x3 pixels)
    const eyeY = headY + 7;
    // Left eye
    rect(18, eyeY, 2, 3, '#241D1A');
    p(18, eyeY, '#FAF7F2'); // gentle glint
    // Right eye
    rect(28, eyeY, 2, 3, '#241D1A');
    p(28, eyeY, '#FAF7F2'); // gentle glint

    // Eyebrows
    rect(18, eyeY - 2, 3, 1, hair.shadow);
    rect(27, eyeY - 2, 3, 1, hair.shadow);

    // Sweet small smile
    p(23, eyeY + 4, '#5C3831');
    p(24, eyeY + 4, '#5C3831');

    // Warm peach/rose blush
    rect(16, eyeY + 2, 2, 2, skin.blush);
    rect(30, eyeY + 2, 2, 2, skin.blush);

    // 7. FRONT HAIR / STYLES
    if (config.hairStyleId === 'short-wavy') {
      // Lead A short wavy parted hair
      rect(14, headY - 3, 20, 5, hair.base);
      rect(13, headY - 1, 22, 4, hair.base);
      // Highlights & clumps
      rect(15, headY - 4, 8, 2, hair.highlight);
      rect(25, headY - 3, 7, 2, hair.highlight);
      // Side part sweeping down
      rect(14, headY + 1, 4, 6, hair.base);
      rect(17, headY + 1, 3, 3, hair.shadow);
      rect(29, headY + 1, 4, 5, hair.base);
      // Outline bits
      p(13, headY + 4, hair.shadow);
      p(32, headY + 4, hair.shadow);
    } else if (config.hairStyleId === 'shoulder-wave') {
      // Lead B shoulder waves
      rect(14, headY - 3, 20, 5, hair.base);
      rect(13, headY - 1, 22, 6, hair.base);
      rect(14, headY - 4, 10, 2, hair.highlight);
      // Front bangs framing forehead
      rect(14, headY + 2, 4, 7, hair.base);
      rect(30, headY + 2, 4, 7, hair.base);
      p(18, headY + 1, hair.base);
      p(29, headY + 1, hair.base);
    } else if (config.hairStyleId === 'curly-coils') {
      // Curly afro puffs
      rect(13, headY - 4, 22, 8, hair.base);
      rect(12, headY - 2, 24, 7, hair.base);
      // Textures
      for (let cx = 14; cx <= 32; cx += 3) {
        p(cx, headY - 4, hair.highlight);
        p(cx + 1, headY - 2, hair.shadow);
      }
      rect(13, headY + 4, 3, 4, hair.base);
      rect(32, headY + 4, 3, 4, hair.base);
    } else if (config.hairStyleId === 'bob-part') {
      // Chic sleek bob
      rect(14, headY - 3, 20, 6, hair.base);
      rect(13, headY + 1, 4, 10, hair.base);
      rect(31, headY + 1, 4, 10, hair.base);
      rect(16, headY - 2, 16, 2, hair.highlight);
    } else if (config.hairStyleId === 'hijab-wrap') {
      // Front draping hijab
      const wrapColor = '#BD725D';
      const wrapShade = '#9E5B4B';
      rect(13, headY - 3, 22, 6, wrapColor);
      rect(13, headY + 3, 4, 14, wrapColor);
      rect(31, headY + 3, 4, 14, wrapColor);
      rect(15, headY + 14, 18, 4, wrapShade);
      // Underscarf accent band
      rect(18, headY, 12, 1, '#F7EBD4');
    } else if (config.hairStyleId === 'silver-bun') {
      // Top bun
      rect(21, headY - 7, 7, 5, hair.base);
      rect(22, headY - 8, 5, 2, hair.highlight);
      rect(14, headY - 3, 20, 5, hair.base);
      rect(13, headY + 1, 4, 6, hair.base);
      rect(31, headY + 1, 4, 6, hair.base);
    } else if (config.hairStyleId === 'clean-crop') {
      rect(14, headY - 2, 20, 4, hair.base);
      rect(14, headY + 1, 3, 4, hair.base);
      rect(31, headY + 1, 3, 4, hair.base);
      rect(15, headY - 3, 10, 1, hair.highlight);
    }

    // 8. GLASSES
    if (config.glassesId === 'round-cocoa') {
      const gCol = '#4A352F';
      // Left rim (5x5 square frame with transparent center)
      rect(17, eyeY - 1, 5, 1, gCol);
      rect(17, eyeY + 3, 5, 1, gCol);
      rect(16, eyeY, 1, 3, gCol);
      rect(21, eyeY, 1, 3, gCol);
      // Right rim
      rect(26, eyeY - 1, 5, 1, gCol);
      rect(26, eyeY + 3, 5, 1, gCol);
      rect(25, eyeY, 1, 3, gCol);
      rect(31, eyeY, 1, 3, gCol);
      // Bridge & side arms
      rect(22, eyeY + 1, 3, 1, gCol);
      rect(14, eyeY + 1, 2, 1, gCol);
      rect(32, eyeY + 1, 2, 1, gCol);
    } else if (config.glassesId === 'gold-wire') {
      const gGold = '#C4A052';
      rect(17, eyeY - 1, 4, 1, gGold);
      rect(17, eyeY + 3, 4, 1, gGold);
      rect(16, eyeY, 1, 3, gGold);
      rect(21, eyeY, 1, 3, gGold);
      rect(27, eyeY - 1, 4, 1, gGold);
      rect(27, eyeY + 3, 4, 1, gGold);
      rect(26, eyeY, 1, 3, gGold);
      rect(31, eyeY, 1, 3, gGold);
      rect(22, eyeY + 1, 4, 1, gGold);
    }

    // 9. HATS
    if (config.hatId === 'butter-beanie') {
      const beanColor = '#E4BB6B';
      const beanShadow = '#BF984B';
      // Slouchy dome
      rect(14, headY - 6, 20, 6, beanColor);
      rect(16, headY - 8, 16, 2, beanColor);
      p(24, headY - 9, beanShadow);
      // Folded ribbed rim
      rect(13, headY - 1, 22, 3, beanShadow);
      for (let bx = 14; bx < 34; bx += 2) {
        p(bx, headY, '#D8AD55');
      }
    } else if (config.hatId === 'sage-cap') {
      const capColor = '#788961';
      rect(14, headY - 4, 20, 5, capColor);
      // Curved baseball bill
      rect(12, headY, 16, 2, '#5E6D49');
    }

    // 10. ACCESSORIES
    if (config.accessoryId === 'red-scarf') {
      const scColor = '#A84F4B';
      const scShade = '#883C39';
      // Loop around neck
      rect(16, headY + 14, 16, 4, scColor);
      // Hanging scarf tails
      rect(17, headY + 18, 4, 9, scColor);
      rect(17, headY + 26, 4, 2, scShade);
      rect(22, headY + 18, 3, 7, scShade);
    } else if (config.accessoryId === 'gold-hoops') {
      p(13, headY + 11, '#D4AF37');
      p(34, headY + 11, '#D4AF37');
    }
  }, [config]);

  return (
    <div
      className={`inline-block relative select-none ${flipped ? 'scale-x-[-1]' : ''} ${className}`}
      style={{
        width: `${size * 0.75}px`,
        height: `${size}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        className={`w-full h-full pixelated ${animate ? 'animate-pulse duration-[3000ms]' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};

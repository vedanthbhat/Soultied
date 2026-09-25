import { PixelBuffer, mix } from './buffer';
import { SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, Swatch } from './character';
import type { AvatarConfig } from '../types';

/**
 * A character seen from behind (head + shoulders), for the watch-party view
 * where the camera sits behind the couch. Drawn a little larger than the
 * room sprites because they're close to the camera.
 */

export const BACK_W = 56;
export const BACK_H = 56;

const find = <T extends { id: string }>(l: readonly T[], id: string) => l.find((x) => x.id === id) || l[0];

export interface BackFrame {
  /** -1 lean left, 0 upright, 1 lean right (towards partner) */
  lean?: number;
  bob?: number;
}

export function renderCharacterBack(cfg: AvatarConfig, frame: BackFrame = {}) {
  const b = new PixelBuffer(BACK_W, BACK_H);
  const skin = find(SKIN_TONES, cfg.skin);
  const hair: Swatch =
    cfg.hairStyle === 'hijab'
      ? CLOTH_COLORS.find((c) => c.id === cfg.hairColor) || CLOTH_COLORS[1]
      : find(HAIR_COLORS, cfg.hairColor);
  const top = find(CLOTH_COLORS, cfg.topColor);
  const cx = BACK_W / 2;
  const lean = frame.lean || 0;
  const bob = frame.bob || 0;
  const hOff = cfg.height === 'tall' ? -2 : cfg.height === 'short' ? 2 : 0;

  // --- shoulders / back ---------------------------------------------------
  const shTop = 35 + hOff + bob;
  for (let y = shTop; y < BACK_H; y++) {
    const r = y - shTop;
    const half = Math.min(21, 11 + r * 2);
    for (let x = cx - half; x < cx + half; x++) {
      const edge = x === cx - half || x === cx + half - 1;
      let c = top.base;
      if (r === 0 || (r === 1 && Math.abs(x - cx) > half - 4)) c = top.light; // TV rim light on top edge
      else if (edge) c = top.shadow;
      else if (x > cx + 3) c = mix(top.base, top.shadow, 0.35);
      b.set(x, y, c);
    }
  }
  // garment details on the back
  if (cfg.top === 'hoodie') {
    for (let y = 0; y < 8; y++) {
      const half = 8 - Math.floor(y / 2);
      for (let x = cx - half; x < cx + half; x++) b.set(x, shTop + 1 + y, y === 0 ? top.light : mix(top.base, top.shadow, 0.5));
    }
  } else if (cfg.top === 'turtleneck') {
    b.rect(cx - 5, shTop - 3, 10, 4, top.base);
    b.hline(cx - 5, shTop - 3, 10, top.light);
  } else if (cfg.top === 'shirt' || cfg.top === 'kurta') {
    b.rect(cx - 5, shTop - 1, 10, 2, top.light);
    b.vline(cx, shTop + 2, BACK_H - shTop - 2, top.shadow);
  } else if (cfg.top === 'cardigan') {
    b.rect(cx - 4, shTop - 1, 8, 1, '#efe3cb');
  }

  // --- neck ----------------------------------------------------------------
  const headCy = 22 + hOff + bob;
  b.rect(cx - 4 + lean, headCy + 9, 8, shTop - (headCy + 9) + 1, skin.shadow);

  // --- head ----------------------------------------------------------------
  const hx = cx + lean;
  const rx = cfg.hairStyle === 'curls' ? 14 : 12;
  const ry = cfg.hairStyle === 'curls' ? 13.5 : 12.5;
  const inHead = (x: number, y: number, rX = rx, rY = ry) => ((x + 0.5 - hx) / rX) ** 2 + ((y + 0.5 - headCy) / rY) ** 2 <= 1;

  const style = cfg.hairStyle;
  const skinHead = style === 'bald' || style === 'buzz';
  // ears (visible on short styles)
  if (['bald', 'buzz', 'crop', 'tousled', 'curls'].includes(style) && cfg.hat !== 'beanie') {
    b.rect(hx - rx - 1, headCy - 1, 3, 5, skin.shadow);
    b.rect(hx + rx - 2, headCy - 1, 3, 5, skin.shadow);
    if (cfg.extra === 'hoops') {
      b.set(hx - rx - 1, headCy + 3, '#e2b555');
      b.set(hx + rx, headCy + 3, '#e2b555');
    }
  }
  for (let y = Math.floor(headCy - ry - 1); y <= headCy + ry + 1; y++) {
    for (let x = Math.floor(hx - rx - 1); x <= hx + rx + 1; x++) {
      if (!inHead(x, y)) continue;
      const top1 = !inHead(x, y - 1);
      const rightSide = x > hx + rx * 0.35;
      if (skinHead) {
        let c = rightSide ? skin.shadow : skin.base;
        if (top1) c = skin.light;
        if (style === 'buzz' && (x + y) % 2 === 0 && y < headCy + 4) c = mix(c, hair.base, 0.55);
        b.set(x, y, c);
      } else {
        let c = hair.base;
        if (top1) c = hair.light; // rim light from the TV
        else if (rightSide) c = hair.shadow;
        // strand texture
        if (!top1 && (x * 3 + y) % 7 === 0) c = rightSide ? hair.base : hair.shadow;
        if (style === 'curls' && (x + y * 2) % 4 === 0) c = hair.light;
        b.set(x, y, c);
      }
    }
  }
  // nape: short styles show a bit of neck skin at the hairline
  if (style === 'crop' || style === 'tousled') {
    b.rect(hx - 4, headCy + ry - 3, 8, 3, skin.shadow);
    b.set(hx - 4, headCy + ry - 3, hair.base);
    b.set(hx + 3, headCy + ry - 3, hair.base);
  }
  // tousled tufts on top
  if (style === 'tousled') {
    for (const dx of [-7, -3, 1, 5, 8]) {
      b.set(hx + dx, headCy - ry - 1, hair.light);
      b.set(hx + dx + 1, headCy - ry - 2 + (dx % 2 ? 1 : 0), hair.base);
    }
  }
  // bob: straight cut below the jaw
  if (style === 'bob') {
    b.rect(hx - rx, headCy + 2, rx * 2, 9, hair.base);
    b.hline(hx - rx, headCy + 10, rx * 2, hair.shadow);
    b.vline(hx + rx - 1, headCy + 2, 9, hair.shadow);
  }
  // long waves falling over the back
  if (style === 'long') {
    for (let y = headCy + 2; y < Math.min(BACK_H, shTop + 12); y++) {
      const wave = Math.round(Math.sin(y * 0.6) * 1);
      const half = 10 + (y > shTop ? 1 : 0);
      for (let x = hx - half + wave; x < hx + half + wave; x++) {
        const c = x > hx + 3 ? hair.shadow : (x + y) % 6 === 0 ? hair.light : hair.base;
        b.set(x, y, c);
      }
    }
    b.hline(hx - 9, Math.min(BACK_H, shTop + 12) - 1, 18, hair.shadow);
  }
  // bun on top
  if (style === 'bun') {
    for (let y = -5; y <= 4; y++)
      for (let x = -5; x <= 4; x++)
        if ((x + 0.5) ** 2 + (y + 0.5) ** 2 <= 22) b.set(hx + x, headCy - ry - 3 + y, y < -2 ? hair.light : x > 1 ? hair.shadow : hair.base);
    b.hline(hx - 3, headCy - ry + 1, 6, hair.shadow);
  }
  // braid down the back
  if (style === 'braid') {
    for (let y = headCy + 6, i = 0; y < BACK_H - 1; y += 2, i++) {
      b.rect(hx - 3 + (i % 2), y, 5, 2, i % 2 ? hair.base : hair.light);
      b.set(hx + 1 + (i % 2), y + 1, hair.shadow);
    }
    b.rect(hx - 1, BACK_H - 3, 3, 2, '#c4453f'); // tie
  }
  // hijab drapes over the shoulders
  if (style === 'hijab') {
    for (let y = headCy; y < shTop + 7; y++) {
      const t = (y - headCy) / (shTop + 7 - headCy);
      const half = Math.round(12 + t * 9);
      for (let x = hx - half; x < hx + half; x++) {
        let c = hair.base;
        if (x > hx + half - 4) c = hair.shadow;
        if ((x - hx + 40) % 5 === 0 && y > headCy + 4) c = hair.shadow;
        b.set(x, y, c);
      }
    }
  }

  // --- accessories --------------------------------------------------------
  if (cfg.hat === 'beanie') {
    const sw = CLOTH_COLORS.find((c) => c.id === (cfg.topColor === 'mustard' ? 'terracotta' : 'mustard'))!;
    for (let y = Math.floor(headCy - ry - 2); y < headCy - 1; y++)
      for (let x = hx - rx - 1; x <= hx + rx; x++) {
        if (!inHead(x, y, rx + 1, ry + 1)) continue;
        b.set(x, y, y > headCy - 4 ? sw.shadow : (x + y) % 3 === 0 ? sw.light : sw.base);
      }
    b.rect(hx - 2, headCy - ry - 5, 4, 3, sw.light);
  } else if (cfg.hat === 'cap') {
    for (let y = Math.floor(headCy - ry - 1); y < headCy - 2; y++)
      for (let x = hx - rx; x <= hx + rx; x++) if (inHead(x, y, rx + 0.5, ry + 0.5)) b.set(x, y, y === Math.floor(headCy - ry - 1) ? top.light : top.base);
    b.rect(hx - 4, headCy - 3, 8, 3, hair.shadow); // strap gap
    b.hline(hx - 4, headCy - 3, 8, top.shadow);
  } else if (cfg.hat === 'clip') {
    b.rect(hx + 5, headCy - 6, 4, 2, '#d9a441');
  }
  if (cfg.extra === 'headphones') {
    for (let x = hx - rx; x <= hx + rx; x++) {
      const y = Math.round(headCy - Math.sqrt(Math.max(0, 1 - ((x - hx) / rx) ** 2)) * ry) - 1;
      b.set(x, y, '#3b3437');
    }
    b.rect(hx - rx - 2, headCy - 2, 4, 7, '#5a5155');
    b.rect(hx + rx - 2, headCy - 2, 4, 7, '#5a5155');
  }
  if (cfg.extra === 'scarf') {
    b.rect(cx - 9, shTop - 1, 18, 4, '#a84f4b');
    b.hline(cx - 9, shTop - 1, 18, '#c4625b');
    b.rect(cx + 4, shTop + 3, 4, 7, '#7f3835');
  }

  b.outline(0.35);
  return { buf: b, anchor: { x: cx, y: BACK_H - 1 }, headTop: Math.floor(headCy - ry) };
}

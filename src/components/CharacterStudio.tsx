import React, { useState } from 'react';
import { AvatarConfig } from '../types';
import {
  SKIN_TONES,
  HAIR_COLORS,
  CLOTH_COLORS,
  HAIR_STYLES,
  FACIAL_HAIR,
  TOPS,
  BOTTOMS,
  SHOES,
  GLASSES,
  HATS,
  EXTRAS,
  randomAvatar,
  Swatch,
} from '../pixel/character';
import { PixelAvatarRenderer, AvatarThumb, ThumbRegion } from './PixelAvatarRenderer';

type Tab = 'body' | 'hair' | 'outfit' | 'extras';

interface Props {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
  /** Narrow layout for the onboarding sheet */
  compact?: boolean;
}

export const CharacterStudio: React.FC<Props> = ({ value, onChange, compact = false }) => {
  const [tab, setTab] = useState<Tab>('body');
  const set = (patch: Partial<AvatarConfig>) => onChange({ ...value, ...patch });

  const options = <K extends keyof AvatarConfig>({
    label,
    field,
    list,
    region,
    patch,
  }: {
    label: string;
    field: K;
    list: readonly { id: string; name: string }[];
    region: ThumbRegion;
    patch?: (id: string) => Partial<AvatarConfig>;
  }) => (
    <fieldset className="mb-5">
      <legend className="px-label">{label}</legend>
      <div className="flex flex-wrap gap-2.5">
        {list.map((o) => {
          const next = { ...value, [field]: o.id, ...(patch ? patch(o.id) : {}) } as AvatarConfig;
          return (
            <button
              key={o.id}
              type="button"
              className="px-chip"
              aria-pressed={value[field] === o.id}
              onClick={() => onChange(next)}
              title={o.name}
            >
              <AvatarThumb config={next} region={region} size={compact ? 40 : 46} />
              <span className="max-w-[58px] truncate">{o.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const swatches = ({
    label,
    list,
    current,
    onPick,
  }: {
    label: string;
    list: Swatch[];
    current: string;
    onPick: (id: string) => void;
  }) => (
    <fieldset className="mb-5">
      <legend className="px-label">{label}</legend>
      <div className="flex flex-wrap gap-3 pl-1 pt-1">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            className="px-swatch"
            aria-pressed={current === s.id}
            aria-label={s.name}
            title={s.name}
            style={{ background: s.base }}
            onClick={() => onPick(s.id)}
          />
        ))}
      </div>
    </fieldset>
  );

  const hijab = value.hairStyle === 'hijab';

  return (
    <div className={`flex ${compact ? 'flex-col' : 'flex-col md:flex-row'} gap-5`}>
      {/* preview */}
      <div className={`flex ${compact ? 'flex-row items-end gap-4' : 'flex-col items-center gap-3'} shrink-0`}>
        <div
          className="px-inset flex items-end justify-center relative"
          style={{ width: compact ? 120 : 190, height: compact ? 150 : 250 }}
        >
          <div className="absolute inset-x-0 bottom-0 h-[18%]" style={{ background: 'repeating-linear-gradient(90deg,#c9ae86 0 18px,#bfa27a 18px 21px)' }} />
          <div className="relative mb-[6%]">
            <PixelAvatarRenderer config={value} size={compact ? 132 : 216} />
          </div>
        </div>
        <div className={`flex ${compact ? 'flex-col' : 'flex-row'} gap-2`}>
          <button type="button" className="px-btn px-btn--paper px-btn--small" onClick={() => onChange(randomAvatar())}>
            🎲 Surprise me
          </button>
        </div>
      </div>

      {/* options */}
      <div className="flex-1 min-w-0">
        <div role="tablist" aria-label="Customise" className="flex flex-wrap gap-1 mb-4">
          {(
            [
              ['body', 'Body'],
              ['hair', 'Hair'],
              ['outfit', 'Outfit'],
              ['extras', 'Extras'],
            ] as const
          ).map(([id, name]) => (
            <button key={id} role="tab" aria-selected={tab === id} className="px-tab" onClick={() => setTab(id)}>
              {name}
            </button>
          ))}
        </div>

        {tab === 'body' && (
          <>
            {swatches({ label: "Skin tone", list: SKIN_TONES, current: value.skin, onPick: (id) => set({ skin: id }) })}
            {options({ label: "Height", field: "height", list: [
                { id: 'short', name: 'Short' },
                { id: 'medium', name: 'Medium' },
                { id: 'tall', name: 'Tall' },
              ], region: "full" })}
            {options({ label: "Facial hair", field: "facialHair", list: FACIAL_HAIR, region: "head" })}
          </>
        )}

        {tab === 'hair' && (
          <>
            {options({ label: "Style", field: "hairStyle", list: HAIR_STYLES, region: "head", patch: (id) =>
                id === 'hijab' && !CLOTH_COLORS.some((c) => c.id === value.hairColor)
                  ? { hairColor: 'sage', hat: 'none' }
                  : id !== 'hijab' && !HAIR_COLORS.some((c) => c.id === value.hairColor)
                  ? { hairColor: 'cocoa' }
                  : {}
               })}
            {value.hairStyle !== 'bald' && (
              swatches({ label: hijab ? 'Scarf colour' : 'Hair colour', list: hijab ? CLOTH_COLORS : HAIR_COLORS, current: value.hairColor, onPick: (id) => set({ hairColor: id }) })
            )}
          </>
        )}

        {tab === 'outfit' && (
          <>
            {options({ label: "Top", field: "top", list: TOPS, region: "torso" })}
            {swatches({ label: "Top colour", list: CLOTH_COLORS, current: value.topColor, onPick: (id) => set({ topColor: id }) })}
            {options({ label: "Bottoms", field: "bottom", list: BOTTOMS, region: "legs" })}
            {swatches({ label: "Bottoms colour", list: CLOTH_COLORS, current: value.bottomColor, onPick: (id) => set({ bottomColor: id }) })}
            {options({ label: "On your feet", field: "shoes", list: SHOES, region: "feet" })}
            {swatches({ label: "Socks & shoes colour", list: CLOTH_COLORS, current: value.shoesColor, onPick: (id) => set({ shoesColor: id }) })}
          </>
        )}

        {tab === 'extras' && (
          <>
            {options({ label: "Glasses", field: "glasses", list: GLASSES, region: "head" })}
            {!hijab && options({ label: "On your head", field: "hat", list: HATS, region: "head" })}
            {options({ label: "Little extras", field: "extra", list: EXTRAS, region: "torso" })}
          </>
        )}
      </div>
    </div>
  );
};

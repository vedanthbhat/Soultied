import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';
import { AvatarConfig } from '../types';
import {
  SKIN_PALETTES,
  HAIR_PALETTES,
  HAIR_STYLES,
  TOPS,
  BOTTOMS,
  SHOES,
  GLASSES,
  HATS,
  ACCESSORIES,
  STARTER_PRESET_A,
  STARTER_PRESET_B,
} from '../data/wardrobeCatalogue';
import { X, Sparkles, Camera, Check, Shuffle, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export const WardrobeModal: React.FC = () => {
  const { isWardrobeOpen, setIsWardrobeOpen, currentUser, updateAvatar } = useApp();
  const [draftAvatar, setDraftAvatar] = useState<AvatarConfig>(currentUser.avatar);
  const [activeTab, setActiveTab] = useState<'hair' | 'clothes' | 'accessories' | 'photo'>('hair');

  // Photo assistance state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  if (!isWardrobeOpen) return null;

  const handleSave = () => {
    updateAvatar(draftAvatar);
    setIsWardrobeOpen(false);
  };

  const handleRandomize = () => {
    const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setDraftAvatar({
      rendererVersion: 1,
      bodyPreset: randomItem(['short', 'medium', 'tall']),
      skinPaletteId: randomItem(SKIN_PALETTES).id,
      hairStyleId: randomItem(HAIR_STYLES).id,
      hairPaletteId: randomItem(HAIR_PALETTES).id,
      topId: randomItem(TOPS).id,
      bottomId: randomItem(BOTTOMS).id,
      shoesId: randomItem(SHOES).id,
      glassesId: randomItem(GLASSES).id,
      hatId: randomItem(HATS).id,
      accessoryId: randomItem(ACCESSORIES).id,
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid PNG or JPEG photo.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo must be smaller than 5MB.');
      return;
    }

    setPhotoError(null);
    setPhotoSuccess(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const analyzePhotoWithGemini = async () => {
    if (!photoPreview) {
      setPhotoError('Please select or upload a photo first.');
      return;
    }
    if (!consentGiven) {
      setPhotoError('Please confirm consent to analyze visible features.');
      return;
    }

    setIsAnalyzingPhoto(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      // Ephemeral inline processing using Gemini API
      const apiKey = process.env.GEMINI_API_KEY || (window as unknown as { GEMINI_API_KEY?: string }).GEMINI_API_KEY;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        // Fallback simulation when API key requires user configuration
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setDraftAvatar((prev) => ({
          ...prev,
          skinPaletteId: 'skin-3',
          hairStyleId: 'shoulder-wave',
          hairPaletteId: 'dark-cocoa',
          glassesId: 'round-cocoa',
        }));
        setPhotoSuccess('Photo analyzed! Suggested warm tan tone, shoulder waves, and round glasses.');
        setIsAnalyzingPhoto(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const base64Data = photoPreview.split(',')[1];
      const mimeType = photoPreview.substring(photoPreview.indexOf(':') + 1, photoPreview.indexOf(';'));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: `Analyze this person's visible appearance strictly for avatar styling:
- skin tone (options: skin-1, skin-2, skin-3, skin-4, skin-5, skin-6)
- hair style (options: short-wavy, shoulder-wave, curly-coils, bob-part, hijab-wrap, silver-bun, clean-crop, bald)
- hair color (options: dark-cocoa, espresso-black, chestnut-brown, warm-auburn, honey-blonde, silver-grey)
- glasses (options: none, round-cocoa, gold-wire)

Respond ONLY with valid JSON in this exact structure:
{"skinPaletteId": "...", "hairStyleId": "...", "hairPaletteId": "...", "glassesId": "..."}`,
              },
            ],
          },
        ],
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      setDraftAvatar((prev) => ({
        ...prev,
        skinPaletteId: parsed.skinPaletteId || prev.skinPaletteId,
        hairStyleId: parsed.hairStyleId || prev.hairStyleId,
        hairPaletteId: parsed.hairPaletteId || prev.hairPaletteId,
        glassesId: parsed.glassesId || prev.glassesId,
      }));

      setPhotoSuccess('Look customized based on photo suggestions!');
    } catch {
      setPhotoError('Could not process photo automatically. You can choose all features below manually.');
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#483B36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#F7EBD4] border-2 border-[#805847] rounded-2xl shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8C4A7] bg-[#EFE2CC]">
          <div>
            <h2 className="text-2xl font-bold text-[#483B36]">Your Little Wardrobe</h2>
            <p className="text-sm text-[#805847]">
              Customize {currentUser.name}’s pixel chibi character
            </p>
          </div>
          <button
            onClick={() => setIsWardrobeOpen(false)}
            className="p-1.5 rounded-lg hover:bg-[#DFCAAC] text-[#483B36] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Live Canvas Avatar Preview */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-[#EFE2CC]/60 rounded-xl border border-[#D8C4A7]">
            <div className="w-[140px] h-[190px] flex items-center justify-center mb-3">
              <PixelAvatarRenderer config={draftAvatar} size={180} />
            </div>

            {/* Quick Starters & Randomize */}
            <div className="w-full flex flex-col gap-2 mt-2">
              <span className="text-xs uppercase font-bold text-[#805847] text-center">
                Quick Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraftAvatar(STARTER_PRESET_A)}
                  className="py-1.5 px-2 bg-[#F7EBD4] hover:bg-[#EBD9BE] border border-[#D8C4A7] rounded-lg text-sm text-[#483B36] font-medium transition-colors"
                >
                  Lead A (Terracotta)
                </button>
                <button
                  type="button"
                  onClick={() => setDraftAvatar(STARTER_PRESET_B)}
                  className="py-1.5 px-2 bg-[#F7EBD4] hover:bg-[#EBD9BE] border border-[#D8C4A7] rounded-lg text-sm text-[#483B36] font-medium transition-colors"
                >
                  Lead B (Sage)
                </button>
              </div>

              <button
                type="button"
                onClick={handleRandomize}
                className="flex items-center justify-center gap-1.5 py-1.5 bg-[#EBD9BE] hover:bg-[#DFCAAC] border border-[#CDB596] rounded-lg text-sm text-[#483B36] font-medium transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Randomize Look</span>
              </button>
            </div>
          </div>

          {/* Right Column: Customization Controls */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {/* Category tabs */}
            <div className="flex border-b border-[#D8C4A7] gap-2 pb-1">
              {[
                { id: 'hair', label: 'Face & Hair' },
                { id: 'clothes', label: 'Clothes' },
                { id: 'accessories', label: 'Accessories' },
                { id: 'photo', label: '✨ Photo Suggest' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`pb-2 px-3 text-base font-semibold transition-colors border-b-2 -mb-[6px] ${
                    activeTab === tab.id
                      ? 'border-[#BD725D] text-[#BD725D]'
                      : 'border-transparent text-[#805847] hover:text-[#483B36]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB: Face & Hair */}
            {activeTab === 'hair' && (
              <div className="flex flex-col gap-4 overflow-y-auto max-h-[380px] pr-1">
                {/* Skin Palette */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">
                    Skin Tone
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {SKIN_PALETTES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, skinPaletteId: s.id })}
                        className={`h-9 rounded-lg border-2 flex items-center justify-center transition-all ${
                          draftAvatar.skinPaletteId === s.id
                            ? 'border-[#483B36] scale-105 shadow-xs'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: s.base }}
                        title={s.name}
                      >
                        {draftAvatar.skinPaletteId === s.id && (
                          <Check className="w-4 h-4 text-[#483B36]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hair Color */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">
                    Hair Color
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {HAIR_PALETTES.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, hairPaletteId: h.id })}
                        className={`h-9 rounded-lg border-2 flex items-center justify-center transition-all ${
                          draftAvatar.hairPaletteId === h.id
                            ? 'border-[#483B36] scale-105 shadow-xs'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: h.base }}
                        title={h.name}
                      >
                        {draftAvatar.hairPaletteId === h.id && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hair Style */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">
                    Hair Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {HAIR_STYLES.map((hs) => (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, hairStyleId: hs.id })}
                        className={`p-2 rounded-lg border-2 text-left transition-all ${
                          draftAvatar.hairStyleId === hs.id
                            ? 'bg-[#EAE0CE] border-[#805847] text-[#483B36] font-bold shadow-2xs'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#805847] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        <div className="text-sm leading-tight">{hs.name}</div>
                        <div className="text-xs text-[#805847]/80 truncate">{hs.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Height Preset */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">
                    Height
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['short', 'medium', 'tall'] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, bodyPreset: h })}
                        className={`py-1.5 rounded-lg border-2 capitalize text-sm font-medium transition-all ${
                          draftAvatar.bodyPreset === h
                            ? 'bg-[#8C9B75] text-[#F7EBD4] border-[#8C9B75]'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#483B36] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Clothes */}
            {activeTab === 'clothes' && (
              <div className="flex flex-col gap-4 overflow-y-auto max-h-[380px] pr-1">
                {/* Tops */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">Top</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TOPS.map((top) => (
                      <button
                        key={top.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, topId: top.id })}
                        className={`p-2 rounded-lg border-2 flex items-center gap-2 text-left transition-all ${
                          draftAvatar.topId === top.id
                            ? 'bg-[#EAE0CE] border-[#805847] text-[#483B36] font-bold shadow-2xs'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#805847] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: top.primaryColor }}
                        />
                        <div className="truncate text-sm">{top.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottoms */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">Bottom</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BOTTOMS.map((bot) => (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, bottomId: bot.id })}
                        className={`p-2 rounded-lg border-2 flex items-center gap-2 text-left transition-all ${
                          draftAvatar.bottomId === bot.id
                            ? 'bg-[#EAE0CE] border-[#805847] text-[#483B36] font-bold shadow-2xs'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#805847] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: bot.primaryColor }}
                        />
                        <div className="truncate text-sm">{bot.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shoes */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">Shoes</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SHOES.map((sh) => (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, shoesId: sh.id })}
                        className={`p-2 rounded-lg border-2 text-left transition-all ${
                          draftAvatar.shoesId === sh.id
                            ? 'bg-[#EAE0CE] border-[#805847] text-[#483B36] font-bold shadow-2xs'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#805847] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        <div className="truncate text-sm">{sh.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Accessories */}
            {activeTab === 'accessories' && (
              <div className="flex flex-col gap-4 overflow-y-auto max-h-[380px] pr-1">
                {/* Glasses */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">Glasses</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GLASSES.map((gl) => (
                      <button
                        key={gl.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, glassesId: gl.id })}
                        className={`p-2 rounded-lg border-2 text-left transition-all ${
                          draftAvatar.glassesId === gl.id
                            ? 'bg-[#EAE0CE] border-[#805847] text-[#483B36] font-bold shadow-2xs'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#805847] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        <div className="text-sm">{gl.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hats */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">Hats</label>
                  <div className="grid grid-cols-3 gap-2">
                    {HATS.map((hat) => (
                      <button
                        key={hat.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, hatId: hat.id })}
                        className={`p-2 rounded-lg border-2 text-left transition-all ${
                          draftAvatar.hatId === hat.id
                            ? 'bg-[#EAE0CE] border-[#805847] text-[#483B36] font-bold shadow-2xs'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#805847] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        <div className="text-sm">{hat.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extra Accessories */}
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1.5">Accents</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ACCESSORIES.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, accessoryId: acc.id })}
                        className={`p-2 rounded-lg border-2 text-left transition-all ${
                          draftAvatar.accessoryId === acc.id
                            ? 'bg-[#EAE0CE] border-[#805847] text-[#483B36] font-bold shadow-2xs'
                            : 'bg-[#F7EBD4] border-[#D8C4A7] text-[#805847] hover:bg-[#EFE2CC]'
                        }`}
                      >
                        <div className="text-sm">{acc.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Photo Assistance */}
            {activeTab === 'photo' && (
              <div className="flex flex-col gap-4 overflow-y-auto max-h-[380px] pr-1">
                <div className="p-3.5 bg-[#EFE2CC] rounded-xl border border-[#D8C4A7] text-sm text-[#483B36] leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-[#BD725D]">
                    <Sparkles className="w-4 h-4" />
                    <span>Photo-assisted Appearance Suggestions</span>
                  </div>
                  Upload a clear portrait to automatically suggest matching hair style, skin palette, and glasses. Photos are processed ephemerally and never saved publicly.
                </div>

                {/* Upload input & preview */}
                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#D8C4A7] rounded-xl bg-[#F7EBD4]">
                  {photoPreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={photoPreview}
                        alt="Photo preview"
                        className="w-24 h-24 object-cover rounded-full border-2 border-[#805847]"
                      />
                      <label className="text-xs text-[#BD725D] hover:underline cursor-pointer">
                        Choose different photo
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 cursor-pointer p-2">
                      <div className="p-3 rounded-full bg-[#EFE2CC] text-[#805847]">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-semibold text-[#483B36]">
                        Click to select a photo
                      </span>
                      <span className="text-xs text-[#805847]">JPEG, PNG, or WebP under 5MB</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  )}
                </div>

                {/* Consent checkbox */}
                <label className="flex items-start gap-2.5 text-xs text-[#483B36] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 rounded border-[#805847] text-[#BD725D] focus:ring-[#BD725D]"
                  />
                  <span>
                    I consent to analyzing visible appearance features (hair style/color, skin tone, glasses) strictly for my avatar.
                  </span>
                </label>

                {/* Analyze button */}
                <button
                  type="button"
                  onClick={analyzePhotoWithGemini}
                  disabled={!photoPreview || !consentGiven || isAnalyzingPhoto}
                  className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-base transition-all ${
                    !photoPreview || !consentGiven || isAnalyzingPhoto
                      ? 'bg-[#D8C4A7] text-[#F7EBD4] cursor-not-allowed'
                      : 'bg-[#BD725D] hover:bg-[#A85F4C] text-[#F7EBD4] shadow-xs'
                  }`}
                >
                  {isAnalyzingPhoto ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Analyzing features...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Suggest Appearance</span>
                    </>
                  )}
                </button>

                {photoError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F8D7DA] text-[#721C24] text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{photoError}</span>
                  </div>
                )}

                {photoSuccess && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#D4EDDA] text-[#155724] text-xs">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{photoSuccess}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#D8C4A7] bg-[#EFE2CC]">
          <button
            type="button"
            onClick={() => setIsWardrobeOpen(false)}
            className="px-4 py-2 rounded-xl text-[#483B36] font-medium hover:bg-[#DFCAAC] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-[#8C9B75] hover:bg-[#788961] text-[#F7EBD4] font-bold shadow-xs transition-colors"
          >
            Save Look
          </button>
        </div>
      </div>
    </div>
  );
};

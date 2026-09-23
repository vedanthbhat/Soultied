# Asset Manifest & Role Documentation

This document describes all referenced art assets, their role, dimensions, transparency, and usage in Thread & Bean.

| Logical Name | Source File | Role | Dimensions | Transparency | Notes |
|---|---|---|---|---|---|
| `01-shared-room` | `public/assets/01-shared-room.png` | Runtime Background | 1536 × 1024 | Opaque | Empty living room with sage couch, fireplace, bookshelf, and clear terracotta rug at the base. Avatars are rendered on top dynamically. |
| `02-character-guide` | Visual Reference | Appearance Reference | 1536 × 1024 | Opaque | Proportions and style guide for 3-head-tall chibi human avatars with turnaround views. Reference for modular canvas sprite generation. |
| `03-starter-avatar-a` | Visual Reference / Preset | Static Transparent Starter | 1254 × 1254 | Alpha PNG | Starter appearance preset for Lead A (terracotta cardigan, dark wavy hair, cream sneakers). |
| `04-starter-avatar-b` | Visual Reference / Preset | Static Transparent Starter | 1254 × 1254 | Alpha PNG | Starter appearance preset for Lead B (sage sweater, shoulder-length wavy hair, cocoa trousers). |
| `05-wardrobe-and-props-guide` | Visual Reference | Wardrobe Contact Sheet | 1254 × 1254 | Opaque | 4x4 contact sheet illustrating sweaters, hoodies, cardigans, trousers, skirt, beanies, glasses, mugs, plant, and letter. |
| `06-interface-reference` | Visual Reference | UI Composition Reference | 1536 × 1024 | Opaque | High-fidelity desktop mockup showing header, room layout with red thread, question card, streak strip, and typography hierarchy. |

## Typography Asset
- **Font**: Pixelify Sans (Variable TTF, weights 400–700)
- **Files**: `public/fonts/PixelifySans-Variable.ttf`, `public/fonts/OFL.txt`
- **Application**: Applied globally to wordmark, headers, cards, buttons, forms, and dialogs.

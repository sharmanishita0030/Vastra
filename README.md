# Atelier AI — Style Wardrobe

A minimalist, modern AI-powered digital wardrobe application. Organizes personal clothing photographs into curated category baskets, isolates garments via computer vision, generates personalized outfit combinations with editorial styling advice, and provides curated Amazon India shopping recommendations.

---

## Key Features

1. **Atelier Minimalist UI**:
   - High-fashion editorial aesthetic inspired by luxury fashion ateliers.
   - Balanced 50/50 two-panel desktop layout (Digital Wardrobe on the left, AI Stylist on the right).
   - Seamless dark mode and warm-neutral light mode toggling with persistent user preference.
   - Gents and Ladies collection switcher with immediate UI state updates and persistent scoping.

2. **Large Basket-Style Wardrobe Folders**:
   - Large, organized storage bin category cards.
   - **Strict Empty State**: When no clothes have been uploaded, all baskets display a dashed amber border, `0 ITEMS`, and an `UPLOAD A PHOTO TO FILL` prompt. No stock or fake clothes are ever fabricated.
   - **Populated State**: Displays actual garment count, extracted thumbnail stacks, and quick navigation into category inspection drawers.

3. **AI Vision Garment Extraction**:
   - Powered by Gemini 3 Flash (`gemini-3.8-flash`).
   - Identifies multiple visible clothing items, footwear, and accessories from a single uploaded photograph.
   - Extracts bounding coordinates and crops individual garment thumbnails client-side via HTML5 Canvas.
   - **Review Before Saving**: Allows users to inspect isolated crops, correct categories, edit color and style attributes, and select which items to persist.

4. **Outfit Recommendation Engine**:
   - Deterministic candidate pairing engine combined with Gemini AI personal stylist explanations.
   - Scores color harmony, formality, silhouette, and occasion suitability.
   - **Empty Wardrobe Guard**: If "Show Outfits" is clicked when the wardrobe is empty, prompts an upload modal rather than inventing items.
   - Strictly ensures every item ID in recommendations belongs to the authenticated user's wardrobe.

5. **Curated Amazon Shopping Recommendations**:
   - Clean, uncluttered interface: Amazon links are removed from the main view.
   - A dedicated **Shop Recommendations** button opens a curated modal featuring boutique cards with verified Amazon India search queries (`https://www.amazon.in/s?k=...`).
   - No fake product listings or scraped availability.

6. **Authentication & Multi-User Isolation**:
   - Secure registration and login with salt-based password hashing (`crypto.scryptSync`).
   - Scoped user queries: User A can never view, edit, or delete User B's wardrobe.
   - Instant 1-click Guest Demo mode for fast evaluation.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Express on Node.js (mounted via Vite middleware in development)
- **AI Integration**: `@google/genai` TypeScript SDK (`gemini-3.8-flash`)
- **Storage**: Persistent JSON database engine with atomic writes (`/data/wardrobe-db.json`)
- **Image Processing**: HTML5 Canvas client-side bounding-box cropping

---

## Quick Start Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `GEMINI_API_KEY` is present. (In Google AI Studio Build, this key is automatically injected).

### 3. Run Development Server
```bash
npm run dev
```
The application will be live at `http://localhost:3000`.

### 4. Run Automated Test Suite
```bash
npm test
```
Executes the comprehensive automated tests covering password security, user isolation, collection filtering, empty wardrobe enforcement, recommendation integrity, and Amazon URL encoding.

---

## Project Structure

```
├── server.ts                       # Express server mounting API and Vite middleware
├── package.json                    # Project configuration and dependencies
├── vite.config.ts                  # Vite build and plugin setup
├── index.html                      # HTML entry with Atelier AI branding and fonts
├── metadata.json                   # Applet metadata and Gemini API capabilities
├── data/                           # Persistent database storage
│   └── wardrobe-db.json
├── src/
│   ├── main.tsx                    # React client entry point
│   ├── App.tsx                     # Main 2-panel application orchestrator
│   ├── index.css                   # Tailwind v4 import and editorial typography
│   ├── types.ts                    # Shared TypeScript interfaces
│   ├── data/
│   │   └── categories.ts           # Data-driven Ladies and Gents category definitions
│   ├── utils/
│   │   └── imageCropper.ts         # HTML5 Canvas bounding-box cropping utility
│   ├── services/
│   │   └── api.ts                  # Frontend API client
│   ├── components/
│   │   ├── Header.tsx              # Top bar with toggles and Shop button
│   │   ├── WardrobeBaskets.tsx     # Large empty/populated basket cards
│   │   ├── StylistPanel.tsx        # Occasion chat, prompt chips, and outfit cards
│   │   ├── UploadModal.tsx         # Drag & drop photo upload and AI review
│   │   ├── EmptyWardrobeModal.tsx  # Upload reminder popup when wardrobe is empty
│   │   ├── CategoryDetailModal.tsx # Inspect, edit, and delete category items
│   │   ├── AmazonRecommendationsModal.tsx # Curated Amazon shopping cards
│   │   └── AuthModal.tsx           # Authentication modal
│   └── server/
│       ├── storage.ts              # File-based JSON database with user isolation
│       ├── ai.ts                   # Gemini 3 Flash vision & styling integration
│       ├── recommendation.ts       # Recommendation ranking & scoring engine
│       └── amazon.ts               # Amazon search recommendation generator
└── tests/
    └── wardrobe.test.ts            # Automated unit and integration test suite
```

---

## Automated Test Results

The test suite validates:
- Cryptographic password hashing & verification
- Duplicate email prevention
- Cross-user data isolation (preventing unauthorized read/write)
- Strict separation between Ladies and Gents collections
- Empty wardrobe handling with zero false inferences
- Recommendation engine item ID integrity (preventing hallucinated IDs)
- Amazon search query URL encoding and safety

Result: `18 Passed, 0 Failed`

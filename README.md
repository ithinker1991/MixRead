# MixRead - MVP Phase 1

An intelligent English reading enhancement tool that helps you improve reading ability through word difficulty awareness and definitions.

## Project Structure

```
MixRead/
├── backend/              # FastAPI backend server
│   ├── main.py          # FastAPI app with API endpoints
│   ├── download_cefr_data.py  # Script to download/process CEFR word data
│   ├── data/            # Word data (generated after download)
│   ├── requirements.txt  # Python dependencies
│   └── venv/            # Virtual environment
│
├── frontend/            # Chrome Extension (Manifest V3)
│   ├── manifest.json    # Extension configuration
│   ├── background.js    # Service worker handling API calls
│   ├── content.js       # Content script for text processing
│   ├── content.css      # Styles for highlights and tooltips
│   ├── popup.html       # Extension popup UI
│   ├── popup.css        # Popup styles
│   └── popup.js         # Popup functionality
│
├── CLAUDE.md            # Development guidelines
├── DevelopPlan.md       # Product roadmap
└── README.md            # This file
```

## Quick Start (Local Development)

### 1. Start the Backend Server

```bash
cd backend

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download CEFR word data (first time only)
python download_cefr_data.py

# Start the server
python main.py
```

The server will run at `http://localhost:8000`

**Verify it's working:**
```bash
curl http://localhost:8000/health
# Response: {"status": "ok", "words_loaded": 6860}
```

### 2. Load Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Navigate to the `frontend/` directory and select it
5. The MixRead extension should now appear in your extensions

### 3. Test the Extension

1. Open any English website (e.g., https://news.bbc.com)
2. You should see certain words highlighted in yellow
3. Click on a highlighted word to see its definition
4. Use the popup (click the MixRead icon) to adjust difficulty
5. Click "Add to Library" to save words to your vocabulary

## API Endpoints

### GET /health
Health check endpoint
- Response: `{"status": "ok", "words_loaded": 6860}`

### GET /word/{word}
Get information about a single word
- Response: CEFR level, definition, example, POS

### POST /highlight-words
Get list of words that should be highlighted based on difficulty level
- Body: `{"words": ["list", "of", "words"], "difficulty_level": "B1"}`
- Response: List of highlighted words with metadata

### POST /batch-word-info
Get detailed information for multiple words
- Body: `{"words": ["word1", "word2"], "difficulty_level": "B1"}`
- Response: Array of word info with definitions

## Features (MVP Phase 1)

✅ **Intelligent word highlighting** - Automatically highlights words based on CEFR difficulty level
✅ **Hover definitions** - Click highlighted words to see English definitions + examples
✅ **Difficulty slider** - Adjust reading difficulty (A1-C2) to show more/fewer words
✅ **Word library** - Save words to personal vocabulary
✅ **Statistics** - Track total words learned and today's additions

## Data Source

- **Word Data**: Open Language Profiles CEFR-J dataset (6,860+ words)
- **Definitions**: Free Dictionary API (https://dictionaryapi.dev)
- **Coverage**: A1 (Beginner) to C2 (Mastery) levels

## Architecture

### Difficulty Detection Logic

A word is highlighted if:
1. **CEFR Level >= User's Selected Level**
   - User at B1 sees: B1, B2, C1, C2 words
   - User at A1 sees: A1, A2, B1, B2, C1, C2 words

### Data Flow

```
User opens English page
    ↓
Content Script tokenizes text
    ↓
Sends word list to Background Service Worker
    ↓
Service Worker queries backend API
    ↓
Backend looks up words in CEFR database
    ↓
Returns highlighted word list
    ↓
Content Script highlights matching words in DOM
    ↓
User clicks word → tooltip with definition appears
```

## Development Notes

- **Frontend**: Pure JavaScript (no frameworks) for MVP simplicity
- **Backend**: FastAPI for fast, async API handling
- **Storage**: Chrome's local storage for user settings and vocabulary
- **Styling**: CSS for clean, non-intrusive highlighting

## Testing Checklist

- [ ] Backend server starts and loads CEFR data
- [ ] Extension loads without errors in Chrome
- [ ] Words are highlighted on English pages
- [ ] Clicking highlighted word shows definition
- [ ] Difficulty slider adjusts highlighted words
- [ ] "Add to Library" saves words to vocabulary
- [ ] Statistics update correctly
- [ ] Clear All button resets vocabulary

## Known Limitations (Phase 1)

- Backend must be running locally (no cloud deployment yet)
- Definitions depend on external API availability
- Limited to English content (designed for English websites)
- No user accounts or cloud sync (data stored locally only)
- Word library not exportable (local storage only)

## Next Steps (Phase 2+)

- Deploy backend to cloud service (Railway, Render, etc.)
- Add user authentication and cloud sync
- Implement flashcard review system
- Add reading statistics and progress tracking
- Support Chinese-English mixed mode
- Mobile app support

## Troubleshooting

**Extension not highlighting words:**
- Ensure backend is running (`python main.py` in backend directory)
- Check Chrome console for errors (F12)
- Try reloading the page or extension

**Definitions not appearing:**
- Check internet connection (external API needed)
- Some words may not be in Free Dictionary API
- Check browser console for API errors

**Words not being added to library:**
- Check browser console for storage errors
- Ensure extension has storage permission

## License

MIT

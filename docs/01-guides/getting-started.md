# MixRead - Getting Started Guide

This guide will walk you through setting up and testing MixRead locally.

## Prerequisites

- Python 3.7+
- Chrome browser
- Terminal/Command line access

## Step 1: Start the Backend Server

The backend is a FastAPI server that provides word definitions and difficulty levels.

### On macOS/Linux:

```bash
# Navigate to the backend directory
cd backend

# Create virtual environment (only needed once)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download CEFR word data (only needed once)
python download_cefr_data.py

# Start the server
python main.py
```

### On Windows:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python download_cefr_data.py
python main.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
Loaded 6860 words from CEFR database
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Verify the server is running:

In a new terminal:
```bash
curl http://localhost:8000/health
```

You should get:
```json
{"status": "ok", "words_loaded": 6860}
```

## Step 2: Load the Extension in Chrome

1. **Open Chrome** and navigate to `chrome://extensions`
2. **Enable Developer Mode** - toggle in the top right corner
3. **Click "Load unpacked"** button
4. **Navigate** to the `frontend/` folder in the MixRead directory
5. **Select** the `frontend` folder
6. **Click "Select Folder"**

You should now see "MixRead" in your extensions list with a purple icon.

## Step 3: Test the Extension

### Option A: Test with a Sample Article

1. Open any English news or article website, such as:
   - https://www.bbc.com/news
   - https://www.theguardian.com
   - https://www.wikipedia.org

2. You should see certain words highlighted in **yellow** with a dotted underline

3. **Click on any highlighted word** to see:
   - The word's definition
   - CEFR difficulty level
   - An example sentence
   - Option to add to your vocabulary

### Option B: Test Locally (Recommended)

Create a simple test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>MixRead Test</title>
</head>
<body>
    <h1>Welcome to MixRead Testing</h1>
    <p>
        The extraordinary phenomenon was quite remarkable.
        Beautiful flowers bloomed throughout the garden.
        The comprehensive analysis demonstrated exceptional results.
    </p>
</body>
</html>
```

1. Save as `test.html`
2. Open in Chrome (drag and drop into browser)
3. You should see words like "extraordinary", "remarkable", "comprehensive" highlighted

## Step 4: Use the Extension

### Adjusting Difficulty Level

1. Click the **MixRead icon** in Chrome (top right)
2. Adjust the **difficulty slider**
3. Levels range from A1 (Easy) to C2 (Difficult)
4. As you adjust, the page will automatically re-highlight with more or fewer words

**What each level shows:**
- **A1**: Very basic words, lots of highlighting
- **B1**: Intermediate words, moderate highlighting
- **C1**: Advanced words, minimal highlighting
- **C2**: Expert level, very few words highlighted

### Building Your Vocabulary

1. Click any **highlighted word**
2. Click **"Add to Library"** button
3. The word is now saved to your vocabulary

### Viewing Your Vocabulary

1. Click the MixRead icon
2. Click **"View Vocabulary"** button
3. See all words you've added (shows count)

### Viewing Statistics

The popup shows:
- **Words Learned Today**: How many new words you added today
- **Total Words**: Total words in your vocabulary

### Clearing Your Vocabulary

1. Click the MixRead icon
2. Click **"Clear All"** button
3. Confirm the action (this cannot be undone)

## Testing Checklist

Use this checklist to verify everything is working:

- [ ] Backend server starts without errors
- [ ] Health check endpoint works (`curl http://localhost:8000/health`)
- [ ] Extension loads in Chrome without errors
- [ ] Words are highlighted in yellow on English pages
- [ ] Clicking a highlighted word shows a tooltip with:
  - [ ] Word definition
  - [ ] CEFR level
  - [ ] Example sentence
- [ ] Can add words to vocabulary with "Add to Library" button
- [ ] Difficulty slider is visible in popup
- [ ] Adjusting difficulty slider changes which words are highlighted
- [ ] "View Vocabulary" shows added words
- [ ] Statistics (Today/Total) are displayed
- [ ] "Clear All" button works

## Common Issues and Solutions

### Issue: "Words are not being highlighted"

**Solutions:**
1. Check that the backend server is running:
   ```bash
   curl http://localhost:8000/health
   ```
   Should return `{"status": "ok", "words_loaded": 6860}`

2. Reload the Chrome extension:
   - Go to `chrome://extensions`
   - Find MixRead
   - Click the reload icon

3. Reload the webpage

### Issue: "Definitions are not showing"

**Solutions:**
1. Check Chrome console for errors (F12 → Console tab)
2. Make sure you have internet connection (needed for external dictionary API)
3. Try clicking a different word

### Issue: "Extension doesn't appear in Chrome"

**Solutions:**
1. Make sure you're in Developer Mode (`chrome://extensions` → toggle in top right)
2. Try removing and reloading the extension:
   - Remove: Click trash icon next to MixRead
   - Reload: Click "Load unpacked" and select frontend folder again

### Issue: "CEFR data not loading"

**Solutions:**
1. Make sure you ran `python download_cefr_data.py` in the backend directory
2. Check that `backend/data/cefr_words.json` exists (should be ~0.4 MB)
3. Restart the backend server

## Next Steps

After confirming everything works:

1. **Test on different websites** - Try various English content
2. **Build your vocabulary** - Add words as you read
3. **Experiment with difficulty levels** - Find what works best for you
4. **Check statistics** - See your daily progress

## Getting Help

If you encounter issues:

1. Check the Chrome console for error messages (F12)
2. Check the backend server logs
3. Try reloading both the extension and the webpage
4. Restart the backend server

## Architecture Overview

Here's how it works:

```
1. You visit an English website
2. MixRead content script extracts all text
3. Words are sent to backend for analysis
4. Backend checks CEFR difficulty database
5. Backend returns list of difficult words
6. Content script highlights those words
7. You click a word to see its definition
8. Backend fetches definition from dictionary API
9. Definition appears in a tooltip
```

## Backend API Reference

For developers, here are the available API endpoints:

### GET /health
Returns server status and word count

### GET /word/{word}
Get definition and CEFR level for a single word

### POST /highlight-words
Get list of words to highlight based on difficulty

### POST /batch-word-info
Get definitions for multiple words at once

See `README.md` for detailed API documentation.

## Performance Tips

- The extension works best on pages with moderate amounts of text
- Very long pages might take a few seconds to process
- Clearing your browser cache can help if highlighting seems stale
- Adjust difficulty to control how many words are highlighted (fewer = faster)

## What's Coming Next

Phase 2 features (not in MVP):
- Cloud deployment (no need to run server locally)
- Flashcard review system
- Reading statistics and progress graphs
- User accounts and cloud sync
- Mobile app support

Enjoy learning! 📚

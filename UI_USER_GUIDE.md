# Mark as Known Feature - User Guide

## Right-Click Context Menu

When you right-click on any word on the page, a context menu appears with three options:

### Menu Item 1: Mark as Unknown / Remove from Unknown (Toggle)

**State A: Word is NOT marked as unknown**
```
┌─────────────────────────────┐
│ Mark as Unknown             │ ← Click to mark
│ Mark as Known               │
│ Search Definition           │
└─────────────────────────────┘
```

**State B: Word IS marked as unknown**
```
┌─────────────────────────────┐
│ ✓ Remove from Unknown       │ ← Click to unmark
│ Mark as Known               │
│ Search Definition           │
└─────────────────────────────┘
```

---

### Menu Item 2: Mark as Known

This is a **one-way action** that marks the word as known. Once marked:
- The word will **NOT be highlighted** (even if it's above difficulty threshold)
- You can remove it later using the context menu or by marking it as unknown

```
┌─────────────────────────────┐
│ Mark as Unknown             │
│ Mark as Known               │ ← Click to mark
│ Search Definition           │
└─────────────────────────────┘
```

---

### Menu Item 3: Search Definition

Open a dictionary or search for the word definition (placeholder for future implementation).

---

## Use Cases

### Use Case 1: Word appears due to difficulty level, but I know it

1. Open a web page with MixRead active
2. Set difficulty slider to a level (e.g., B1)
3. Some words are highlighted because they're B2 level (higher than B1 threshold)
4. You recognize one of the highlighted words: "proficiency"
5. Right-click on "proficiency"
6. Click "Mark as Known"
7. ✅ "proficiency" is now excluded from highlighting

**Before**:
```
I want to improve my proficiency in [proficiency] reading.
                    ^^^^^^^^^^^^^ highlighted (B2 > B1 threshold)
```

**After marking as known**:
```
I want to improve my proficiency in reading.
                    ^^^^^^^^^^^^^ no longer highlighted
```

---

### Use Case 2: I want to learn this word, so mark it as unknown

1. Right-click on a word
2. Click "Mark as Unknown"
3. ✅ Word is now explicitly marked for learning
4. Word will be highlighted whenever you see it (regardless of difficulty level)

**Before**:
```
The experiment showed extraordinary results.
                     ^^^^^^^^^^^^^^^ not highlighted (already in word list)
```

**After marking as unknown**:
```
The experiment showed extraordinary results.
                     ^^^^^^^^^^^^^^^ now highlighted (explicitly marked)
```

---

### Use Case 3: I changed my mind - I actually know this word

1. Right-click on the word you marked as unknown
2. Click "Remove from Unknown"
3. ✅ Word is no longer explicitly marked
4. Word highlighting depends on difficulty level now

**Before**:
```
The experiment showed extraordinary results.
                     ^^^^^^^^^^^^^^^ highlighted (marked as unknown)
```

**After removing**:
```
The experiment showed extraordinary results.
                     ^^^^^^^^^^^^^^^ may or may not be highlighted
                                     (depends on B2 level vs your threshold)
```

---

## Highlighting Decision Tree

When MixRead decides whether to highlight a word:

```
┌─ Is the word in unknown_words list?
│  ├─ YES → ✅ HIGHLIGHT (user explicitly wants to learn)
│  └─ NO  → ┌─ Is the word in known_words list?
│           ├─ YES → ❌ DON'T HIGHLIGHT (user knows it)
│           └─ NO  → ┌─ Is word's CEFR level > your difficulty threshold?
│                    ├─ YES → ✅ HIGHLIGHT (too difficult for current level)
│                    └─ NO  → ❌ DON'T HIGHLIGHT (within your level)
```

---

## Examples

### Example 1: B1 Difficulty Setting

You set difficulty to B1. Words are categorized:

| Word | CEFR Level | Status | Highlighted? |
|------|------------|--------|--------------|
| the | A1 | (none) | ❌ No |
| beautiful | A2 | (none) | ❌ No |
| abandon | B1 | (none) | ❌ No |
| proficiency | B2 | (none) | ✅ Yes (> B1) |
| proficiency | B2 | ✅ known | ❌ No |
| proficiency | B2 | ✅ unknown | ✅ Yes |

---

### Example 2: User Marks Words as Known

Starting state:
```
Text: "The serenity and proficiency required..."
        ^^^^^^ unknown    ^^^^^^^^^^^^ unknown (B2 > B1)
```

After marking both as known:
```
Text: "The serenity and proficiency required..."
        (no highlighting - both marked as known)
```

---

## Summary

✅ **Three-Tier Control**:
1. Explicitly unknown → Always highlight
2. Explicitly known → Never highlight
3. Unmarked → Highlight based on difficulty level

✅ **Your Control**:
- Mark words you're learning
- Mark words you already know
- Let the system decide for others

✅ **Synced Across Devices**:
- Your known/unknown words are saved to your backend profile
- Same settings apply everywhere you use MixRead

---

## Keyboard Shortcuts (Future)

| Action | Shortcut |
|--------|----------|
| Mark as unknown | Ctrl+U / Cmd+U |
| Mark as known | Ctrl+K / Cmd+K |
| Toggle selection | Spacebar |

*(Currently available via context menu only)*

---

**Happy learning!** 🎓

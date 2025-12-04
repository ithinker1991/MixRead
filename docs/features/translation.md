# Chinese Translation Feature (中文翻译)

**Status**: Phase 1 MVP (Implemented)
**Last Updated**: 2025-12-03

---

## 1. Overview (概述)

MixRead provides inline Chinese translations for highlighted words to assist English learning.
Translations are displayed in small, gray text within parentheses next to the target word.

**Example**:

> This is a beautiful(美丽的) article about extraordinary(非凡的) people.

---

## 2. Technical Implementation (技术实现)

### Backend

- **Dictionary Source**: `backend/chinese_dict.json` (Currently ~70 common words for MVP).
- **API Response**: The `/highlight-words` and `/word/{word}` endpoints include a `chinese` field in the response object.

```python
# Backend Logic
def get_word_info(word):
    return {
        "word": word,
        "chinese": chinese_dict.get(word.lower())
    }
```

### Frontend

- **Display Logic**: `content.js` appends a `<span class="mixread-chinese">` element after the highlighted word if a translation is available.
- **Styling**:
  ```css
  .mixread-chinese {
    color: #6c757d;
    font-size: 0.85em;
  }
  ```

### User Control

- **Toggle Switch**: Users can enable/disable translations via the Popup UI.
- **Persistence**: Setting is saved in `chrome.storage.local` as `showChinese`.
- **Real-time Update**: Toggling the switch immediately updates the current page without reloading.

---

## 3. Future Roadmap (Phase 2)

1.  **Full Dictionary**: Integrate ECDICT (770k words) for comprehensive coverage.
2.  **Display Options**: Allow users to choose display position (inline, tooltip, or bottom).
3.  **Multi-language**: Support other target languages (Japanese, Spanish, etc.).

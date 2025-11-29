/**
 * Simple English Stemmer
 * Reduces words to their root form for vocabulary lookup
 *
 * Examples:
 *   strangers → stranger
 *   dropped → drop
 *   pulling → pull
 *   running → run
 */

class Stemmer {
  /**
   * Get the stem of a word using simple suffix removal rules
   * Prioritizes accuracy over aggressive stemming
   */
  static stem(word) {
    if (!word || word.length < 3) return word;

    word = word.toLowerCase().trim();

    // Check irregular variants first (highest priority)
    if (Stemmer.IRREGULAR_VARIANTS[word]) {
      return Stemmer.IRREGULAR_VARIANTS[word];
    }

    // Rule 1: Handle irregular plurals first
    // These are special cases that don't follow standard rules
    if (word.endsWith('ies') && word.length > 4) {
      // stories → story, babies → baby
      return word.slice(0, -3) + 'y';
    }

    // Rule 2: Remove 'ed' (past tense)
    // walked → walk, dropped → drop
    if (word.endsWith('ed') && word.length > 3) {
      const base = word.slice(0, -2);

      // Handle doubled consonants: dropped → drop (not dropp), hopped → hop
      // But be careful: pulled → pull (don't remove the second l)
      // Only remove if the word before doubling would be 3 chars or less
      if (base.length >= 2) {
        const lastChar = base[base.length - 1];
        const secondLast = base[base.length - 2];

        // If last two chars are same consonant (doubled), and reducing by 1 gives a valid short word
        if (lastChar === secondLast && !this._isVowel(lastChar) && base.length <= 4) {
          // dropped (5 chars) → dropp (4 chars) → drop (3 chars) ✓
          // pulled (5 chars) → pull (4 chars) [skip this rule, it's naturally double-l] ✓
          return base.slice(0, -1);
        }
      }

      if (base.length >= 2) return base;
    }

    // Rule 3: Remove 'ing' (present participle)
    // walking → walk, pulling → pull, running → run
    if (word.endsWith('ing') && word.length > 5) {
      const base = word.slice(0, -3);

      // Handle doubled consonants: running → run (not runi)
      if (base.length >= 2) {
        const lastChar = base[base.length - 1];
        const secondLast = base[base.length - 2];

        // If last two chars are same consonant (doubled), remove one
        if (lastChar === secondLast && !this._isVowel(lastChar)) {
          return base.slice(0, -1);
        }
      }

      return base;
    }

    // Rule 4: Remove 'er' (comparative/agent noun)
    // bigger → big (handle doubled consonants), walker → walk
    if (word.endsWith('er') && word.length > 4) {
      const base = word.slice(0, -2);

      // Handle doubled consonants: bigger → big (not bigg)
      if (base.length >= 2) {
        const lastChar = base[base.length - 1];
        const secondLast = base[base.length - 2];

        // If last two chars are same consonant (doubled), remove one
        if (lastChar === secondLast && !this._isVowel(lastChar)) {
          return base.slice(0, -1);
        }
      }

      if (base.length >= 2) return base;
    }

    // Rule 5: Remove 'est' (superlative)
    // fastest → fast, biggest → big
    if (word.endsWith('est') && word.length > 5) {
      const base = word.slice(0, -3);

      // Handle doubled consonants: biggest → big (not bigg)
      if (base.length >= 2) {
        const lastChar = base[base.length - 1];
        const secondLast = base[base.length - 2];

        // If last two chars are same consonant (doubled), remove one
        if (lastChar === secondLast && !this._isVowel(lastChar)) {
          return base.slice(0, -1);
        }
      }

      if (base.length >= 2) return base;
    }

    // Rule 6: Remove 'ly' (adverb)
    // quickly → quick, slowly → slow, happily → happy
    if (word.endsWith('ly') && word.length > 4) {
      const base = word.slice(0, -2);

      // For words ending in -ily, apply special rule: happily → happy
      if (word.endsWith('ily') && base.length >= 2 && base[base.length - 1] === 'i') {
        // happily → happ + i → happ → hapy → happy
        // Actually, just use: happily → happy by removing 'ily' and adding 'y'
        return word.slice(0, -3) + 'y';
      }

      // Remove 'ly' from adverbs (both vowel and consonant endings)
      // quickly → quick, slowly → slow, carefully → careful, softly → soft
      if (base.length >= 2) {
        return base;
      }
    }

    // Rule 7: Remove simple plural 's'
    // books → book, cats → cat
    // But preserve: bus, glass, class, etc.
    if (word.endsWith('s') && word.length > 2) {
      // Avoid removing 's' from words that naturally end in 's'
      if (!word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) {
        const base = word.slice(0, -1);
        if (base.length >= 2) return base;
      }
    }

    return word; // No suffix matched, return original
  }

  /**
   * Check if a character is a vowel
   */
  static _isVowel(char) {
    return /[aeiou]/.test(char);
  }

  /**
   * Get all possible word forms to try (for fuzzy matching)
   * Returns: [original, stem, common variants]
   */
  static getAllForms(word) {
    const forms = new Set();
    const stem = this.stem(word);

    forms.add(word.toLowerCase());
    forms.add(stem);

    // Add common variants of the stem
    if (stem !== word.toLowerCase()) {
      // Add the stem + common suffixes
      forms.add(stem + 's');      // plural
      forms.add(stem + 'ed');     // past tense
      forms.add(stem + 'ing');    // present participle
      forms.add(stem + 'er');     // agent noun
      forms.add(stem + 'est');    // superlative
      forms.add(stem + 'ly');     // adverb
    }

    return Array.from(forms);
  }
}

// Initialize irregular variants mapping (compatible with all browsers)
Stemmer.IRREGULAR_VARIANTS = {
  // Special cases where standard rules don't work
  "stranger": "stranger",  // 'er' is part of the root, not a suffix
  "making": "make",        // Special case to prevent over-stemming
  "exploration": "explore", // Remove -ation suffix
  "improve": "improve",    // Keep as is

  // pulled/pulling are tricky: pull has natural double-l
  "pulled": "pull",
  "pulling": "pull",
  "pulls": "pull",
  "dropped": "drop",
  "dropping": "drop",
  // More common irregular verbs from the variant table
  "said": "say",
  "went": "go",
  "had": "have",
  "came": "come",
  "made": "make",
  "took": "take",
  "saw": "see",
  "heard": "hear",
  "got": "get",
  "gave": "give",
  "told": "tell",
  "became": "become",
  "began": "begin",
  "brought": "bring",
  "built": "build",
  "bought": "buy",
  "caught": "catch",
  "chose": "choose",
  "did": "do",
  "drew": "draw",
  "drank": "drink",
  "drove": "drive",
  "ate": "eat",
  "fell": "fall",
  "felt": "feel",
  "fought": "fight",
  "found": "find",
  "flew": "fly",
  "forgot": "forget",
  "froze": "freeze",
  "grew": "grow",
  "hung": "hang",
  "kept": "keep",
  "knew": "know",
  "laid": "lay",
  "left": "leave",
  "led": "lead",
  "lent": "lend",
  "let": "let",
  "lay": "lie",
  "lit": "light",
  "lost": "lose",
  "meant": "mean",
  "met": "meet",
  "paid": "pay",
  "put": "put",
  "ran": "run",
  "read": "read",
  "rode": "ride",
  "rose": "rise",
  "sang": "sing",
  "sat": "sit",
  "set": "set",
  "shook": "shake",
  "shone": "shine",
  "shot": "shoot",
  "showed": "show",
  "shut": "shut",
  "sank": "sink",
  "slept": "sleep",
  "spoke": "speak",
  "spent": "spend",
  "spun": "spin",
  "stood": "stand",
  "stole": "steal",
  "stuck": "stick",
  "stung": "sting",
  "struck": "strike",
  "swam": "swim",
  "swore": "swear",
  "swept": "sweep",
  "swung": "swing",
  "taught": "teach",
  "tore": "tear",
  "threw": "throw",
  "understood": "understand",
  "woke": "wake",
  "wore": "wear",
  "wove": "weave",
  "won": "win",
  "wound": "wind",
  "wrote": "write"
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Stemmer;
}

function extractSentences(text, word) {
  // CRITICAL: Clean up frequency markers like (1×), (2×), etc. that some websites embed
  text = text.replace(/\(\d+×\)/g, ""); // Remove (1×), (2×), (3×), etc.
  text = text.replace(/→\s*/g, " "); // Replace arrows with spaces
  text = text.replace(/\s+/g, " ").trim();

  let sentences = [];
  const wordLowerVar = word.toLowerCase();

  try {
    // Use Intl.Segmenter if available (supported in modern Chrome and Node.js)
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const segments = segmenter.segment(text);

    for (const segment of segments) {
      const sentence = segment.segment.trim();
      if (sentence.toLowerCase().includes(wordLowerVar)) {
        sentences.push(sentence);
      }
    }
  } catch (e) {
    console.warn(
      "Intl.Segmenter not supported or failed, falling back to simple split",
      e
    );
    // Fallback to simple split if Intl.Segmenter fails
    sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.toLowerCase().includes(wordLowerVar));
  }

  // Clean up sentences
  sentences = sentences.map((s) => {
    let clean = s.trim();
    // Ensure it ends with punctuation if it looks like a complete sentence
    if (clean.length > 0 && !/[.!?]$/.test(clean)) {
      clean += ".";
    }
    return clean;
  });

  // Remove duplicates
  sentences = [...new Set(sentences)];

  // Filter sentences
  const filteredSentences = sentences.filter((s) => {
    // Basic length checks
    if (s.length < 10) return false;
    // Relaxed word count check (2 words might be enough for short exclamations or commands, but 3 is safer)
    if (s.split(/\s+/).length < 3) return false;

    // Relaxed special character check
    // Allow more special characters, especially parentheses and brackets which are common in examples
    const specialCharCount = (s.match(/[×→]/g) || []).length; // Only count "bad" special chars
    if (specialCharCount > 2) return false;

    // Skip if looks like it's mixing different languages/formats
    if (s.includes("1x") || s.includes("→") || s.match(/\d+×/)) {
      return false;
    }

    // CRITICAL: Skip sentences that contain multiple word-form patterns like "word(1×)"
    const wordFormPatterns = (s.match(/\([0-9×]+\)/g) || []).length;
    if (wordFormPatterns > 3) {
      return false;
    }

    // Skip sentences with non-ASCII characters mixed in (multilingual content)
    // But allow common punctuation
    if (/[\u4E00-\u9FFF]/.test(s) || /[\u3040-\u309F]/.test(s)) {
      return false;
    }

    return true;
  });

  // Fallback if no sentences found
  let finalSentences = filteredSentences;
  if (finalSentences.length === 0) {
    // If we have the word but no valid sentences passed filter, just return the word context
    // Try to find a small window around the word
    const index = text.toLowerCase().indexOf(wordLowerVar);
    if (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + word.length + 20);
      let snippet = text.substring(start, end).trim();
      if (start > 0) snippet = "..." + snippet;
      if (end < text.length) snippet = snippet + "...";
      finalSentences = [snippet];
    } else {
      finalSentences = [`${word} was found on this page.`];
    }
  }

  return {
    original: sentences,
    filtered: finalSentences,
  };
}

const testCases = [
  {
    text: "This is a simple test. The word example is here. Another sentence.",
    word: "example",
    description: "Simple case",
  },
  {
    text: "This is a test with Chinese characters. 这是一个测试. The word example is mixed.",
    word: "example",
    description: "Mixed Chinese characters",
  },
  {
    text: "Short. The example. Too short.",
    word: "example",
    description: "Short sentence",
  },
  {
    text: "Dr. Smith gave an example. It was good.",
    word: "example",
    description: "Abbreviation Dr.",
  },
  {
    text: "e.g. this is an example.",
    word: "example",
    description: "Abbreviation e.g.",
  },
  {
    text: "This (example) has [many] {special} characters.",
    word: "example",
    description: "Special characters",
  },
];

testCases.forEach((tc) => {
  console.log(`\n--- ${tc.description} ---`);
  console.log(`Text: "${tc.text}"`);
  console.log(`Word: "${tc.word}"`);
  const result = extractSentences(tc.text, tc.word);
  console.log("Original Extracted:", result.original);
  console.log("Filtered:", result.filtered);
  if (result.filtered.length === 0) {
    console.log("FALLBACK WOULD BE TRIGGERED");
  }
});

// Test script to inject into a page and test sentence extraction
console.log('Starting sentence extraction test...');

// Simulate highlighted words on the page
function highlightTestWords() {
    const testWords = [
        { word: 'comprehensive', definition: 'complete or including all elements', chinese: '全面的' },
        { word: 'difficult', definition: 'needing much effort or skill', chinese: '困难的' },
        { word: 'understanding', definition: 'the ability to understand something', chinese: '理解' },
        { word: 'testing', definition: 'taking measures to check quality', chinese: '测试' }
    ];

    // Find and highlight words in the page
    testWords.forEach(({ word, definition, chinese }) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (node.parentElement.tagName === 'SCRIPT' ||
                        node.parentElement.tagName === 'STYLE') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(node => {
            if (regex.test(node.textContent)) {
                const span = document.createElement('span');
                span.className = 'mixread-highlight';
                span.style.backgroundColor = 'yellow';
                span.dataset.word = word;
                span.dataset.definition = definition;
                span.dataset.chinese = chinese;

                const parent = node.parentNode;
                const text = node.textContent;
                const matches = [...text.matchAll(regex)];

                let lastIndex = 0;
                matches.forEach(match => {
                    // Add text before the match
                    parent.insertBefore(document.createTextNode(text.substring(lastIndex, match.index)), node);

                    // Add the highlighted span
                    span.textContent = match[0];
                    parent.insertBefore(span.cloneNode(true), node);

                    lastIndex = match.index + match[0].length;
                });

                // Add remaining text
                parent.insertBefore(document.createTextNode(text.substring(lastIndex)), node);
                parent.removeChild(node);
            }
        });
    });

    console.log('Highlighted test words on the page');
}

// Test sentence extraction for a specific word
function testExtractionForWord(word) {
    console.log(`\n=== Testing extraction for word: ${word} ===\n`);

    const elements = document.querySelectorAll(`[data-word="${word}"], [data-word="${word.toLowerCase()}"]`);
    console.log(`Found ${elements.length} elements for word "${word}"`);

    elements.forEach((element, index) => {
        console.log(`\n--- Element ${index + 1} ---`);
        console.log('Element:', element);
        console.log('Text content:', element.textContent);

        // Use the same extraction logic as batch-marking-panel.js
        let paragraph = element.closest('p');
        if (!paragraph) {
            paragraph = element.closest('div, article, section, li') || element.parentElement;
        }

        console.log('Parent element:', paragraph?.tagName.toLowerCase());

        if (paragraph) {
            const clone = paragraph.cloneNode(true);

            // Remove unwanted elements
            const unwantedTags = ['script', 'style', 'nav', 'header', 'footer', 'aside'];
            unwantedTags.forEach(tag => {
                const elements = clone.querySelectorAll(tag);
                elements.forEach(el => el.remove());
            });

            let text = clone.textContent || clone.innerText || '';
            console.log('Raw text:', text.substring(0, 200));

            // Clean up text
            text = text
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .trim();

            console.log('Cleaned text:', text.substring(0, 200));

            // Split into sentences
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
            console.log(`Total sentences found: ${sentences.length}`);

            // Find sentences containing the word
            const targetSentences = sentences
                .map(s => s.trim())
                .filter(s => s.toLowerCase().includes(word.toLowerCase()))
                .filter(s => s.length > 10)
                .slice(0, 3);

            console.log(`Target sentences containing "${word}":`, targetSentences);

            if (targetSentences.length === 0) {
                const fallback = text.substring(
                    Math.max(0, text.indexOf(word) - 50),
                    text.indexOf(word) + word.length + 50
                ).trim();
                console.log(`Fallback text: "${fallback}"`);
            }
        }
    });
}

// Run the test
setTimeout(() => {
    highlightTestWords();

    // Test each word
    ['comprehensive', 'difficult', 'understanding', 'testing'].forEach(word => {
        testExtractionForWord(word);
    });

    // Show test UI
    const ui = document.createElement('div');
    ui.id = 'sentence-test-ui';
    ui.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        border: 2px solid #007bff;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 300px;
        font-size: 12px;
    `;
    ui.innerHTML = `
        <h4>Sentence Extraction Test</h4>
        <p>Words have been highlighted. Check console for extraction results.</p>
        <button onclick="document.getElementById('sentence-test-ui').remove()">Close</button>
    `;
    document.body.appendChild(ui);

    console.log('\n=== Test Complete ===');
    console.log('Open the Batch Mark panel to test the actual sentence extraction in the extension.');
}, 1000);
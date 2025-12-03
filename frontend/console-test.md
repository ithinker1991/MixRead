# MixRead Stemming - Console Test

## 快速测试步骤

1. 打开测试页面：http://localhost:8001/test-page-with-analysis.html
2. 按 **F12** 打开 DevTools
3. 点击 **Console** 标签
4. **复制以下代码粘贴到 Console 中执行**

---

## Test 1: 检查 Stemmer 是否加载

```javascript
console.log('Stemmer available:', typeof Stemmer);
console.log('Stemmer.stem available:', typeof Stemmer?.stem);
```

**预期输出：**
```
Stemmer available: function
Stemmer.stem available: function
```

---

## Test 2: 测试词干提取

```javascript
const testWords = ['stranger', 'strangers', 'dreamed', 'making', 'building', 'exploration'];
console.log('=== Stemming Test ===');
testWords.forEach(word => {
  const stem = Stemmer.stem(word);
  console.log(`${word} → ${stem}`);
});
```

**预期输出：**
```
=== Stemming Test ===
stranger → stranger
strangers → stranger
dreamed → dream
making → make
building → build
exploration → explore
```

---

## Test 3: 检查高亮词

```javascript
const highlights = document.querySelectorAll('.mixread-highlight');
console.log('Total highlighted words:', highlights.length);
console.log('Highlighted words:', Array.from(highlights).map(h => h.textContent).join(', '));
```

**预期输出：**
```
Total highlighted words: 6
Highlighted words: stranger, dreamed, making, building, exploration, ...
```

---

## Test 4: 检查词干映射

```javascript
const article = document.querySelector('.article-text');
const text = article.textContent;
const wordPattern = /\b[a-z''-]+\b/gi;
const words = [];
let match;
while ((match = wordPattern.exec(text)) !== null) {
  words.push(match[0].toLowerCase());
}

const uniqueWords = [...new Set(words)];
const stemMap = {};
uniqueWords.forEach(word => {
  const stem = Stemmer.stem(word);
  if (!stemMap[stem]) stemMap[stem] = [];
  stemMap[stem].push(word);
});

console.log('=== Stem Mapping ===');
Object.entries(stemMap).forEach(([stem, variants]) => {
  if (variants.length > 1) {
    console.log(`${stem}: [${variants.join(', ')}]`);
  }
});
```

**预期输出：**
```
=== Stem Mapping ===
stranger: [stranger, strangers]
dream: [dream, dreamed]
make: [make, making]
build: [build, building]
explore: [explore, exploration]
```

---

## Test 5: 对比高亮词与词干

```javascript
const highlights = document.querySelectorAll('.mixread-highlight');
const highlightedWords = Array.from(highlights).map(h => h.textContent.toLowerCase());
const uniqueHighlighted = [...new Set(highlightedWords)];

console.log('=== Highlighted Words Analysis ===');
console.log('Total highlighted: ' + uniqueHighlighted.length);
console.log('Words:', uniqueHighlighted.join(', '));

// Check for stem issues
const expectedVariants = {
  'stranger': ['stranger', 'strangers'],
  'dream': ['dream', 'dreamed'],
  'make': ['make', 'making'],
  'build': ['build', 'building'],
};

console.log('\n=== Variant Coverage ===');
Object.entries(expectedVariants).forEach(([stem, variants]) => {
  const found = variants.filter(v => uniqueHighlighted.includes(v));
  const missing = variants.filter(v => !uniqueHighlighted.includes(v));

  if (found.length === variants.length) {
    console.log(`✓ ${stem}: ALL FOUND [${found.join(', ')}]`);
  } else if (found.length === 0) {
    console.log(`✗ ${stem}: NONE FOUND [missing: ${missing.join(', ')}]`);
  } else {
    console.log(`⚠ ${stem}: PARTIAL [found: ${found.join(', ')}] [missing: ${missing.join(', ')}]`);
  }
});
```

**预期输出（如果词干提取工作）：**
```
=== Highlighted Words Analysis ===
Total highlighted: 10+
Words: stranger, strangers, dream, dreamed, make, making, build, building, ...

=== Variant Coverage ===
✓ stranger: ALL FOUND [stranger, strangers]
✓ dream: ALL FOUND [dream, dreamed]
✓ make: ALL FOUND [make, making]
✓ build: ALL FOUND [build, building]
```

**预期输出（如果词干提取不工作）：**
```
=== Variant Coverage ===
⚠ stranger: PARTIAL [found: stranger] [missing: strangers]
⚠ dream: PARTIAL [found: dream] [missing: dreamed]
⚠ make: PARTIAL [found: make] [missing: making]
⚠ build: PARTIAL [found: build] [missing: building]
```

---

## 诊断指南

| 输出结果 | 含义 | 下一步 |
|---------|------|--------|
| ✓ ALL FOUND | 词干提取工作正常 | 成功！ |
| ⚠ PARTIAL | 词干提取**未工作** | 需要调查为什么 |
| ✗ NONE FOUND | 词完全没被高亮 | 检查 extension 是否运行 |

---

## 常见问题

### Q: Stemmer 显示 `undefined`？
A: Stemmer 没有加载。检查：
- stemmer.js 文件是否存在
- test-page-with-analysis.html 中 `<script src="scripts/stemmer.js"></script>` 是否正确

### Q: 没有高亮词？
A: Extension 没有运行。检查：
- Extension 是否已加载到 chrome://extensions
- 页面是否通过 http:// (不能是 file://)

### Q: 词干提取显示 PARTIAL？
A: 这正是我们需要调查的问题！说明：
- Stemmer 工作正常
- 但变体扩展（variant expansion）没有工作


#!/usr/bin/env python3
"""
检查测试段落的中文覆盖率
Check Chinese translation coverage for test paragraph
"""

import json
from pathlib import Path

# Load dictionary
dict_path = Path(__file__).parent / "chinese_dict.json"
with open(dict_path, 'r', encoding='utf-8') as f:
    chinese_dict = json.load(f)

# Test paragraph words
test_paragraph = """
Climate change represents one of the most consequential challenges facing humanity.
The ramifications extend across multiple domains including agriculture infrastructure and biodiversity.
Scientists have documented unprecedented temperature fluctuations and volatile weather patterns.
Mitigating these effects requires comprehensive international cooperation and substantial
investment in sustainable technologies. The imperative to act is becoming increasingly urgent
as we observe accelerating environmental degradation.
"""

# Extract unique words
import re
words = re.findall(r'\b[a-z]+\b', test_paragraph.lower())
unique_words = sorted(set(words))

print(f"📊 覆盖率分析 Coverage Analysis")
print(f"=" * 60)
print(f"\n总单词数 Total unique words: {len(unique_words)}")

# Check which words have Chinese
has_chinese = []
no_chinese = []

for word in unique_words:
    if word in chinese_dict:
        has_chinese.append(word)
    else:
        no_chinese.append(word)

print(f"有中文 Has Chinese: {len(has_chinese)} ({len(has_chinese)/len(unique_words)*100:.1f}%)")
print(f"无中文 No Chinese: {len(no_chinese)} ({len(no_chinese)/len(unique_words)*100:.1f}%)")

print(f"\n✅ 有中文的单词 ({len(has_chinese)}):")
for word in has_chinese:
    print(f"   {word:20} → {chinese_dict[word]}")

print(f"\n❌ 缺少中文的单词 ({len(no_chinese)}):")
for word in no_chinese:
    print(f"   {word}")

# Check for plural/form issues
print(f"\n🔍 词形变化问题 Word Form Issues:")
potential_matches = []
for word in no_chinese:
    # Check if base form exists
    if word.endswith('s') and word[:-1] in chinese_dict:
        potential_matches.append((word, word[:-1], chinese_dict[word[:-1]]))
    elif word.endswith('es') and word[:-2] in chinese_dict:
        potential_matches.append((word, word[:-2], chinese_dict[word[:-2]]))
    elif word.endswith('ing') and word[:-3] in chinese_dict:
        potential_matches.append((word, word[:-3], chinese_dict[word[:-3]]))
    elif word.endswith('ing') and word[:-3] + 'e' in chinese_dict:
        potential_matches.append((word, word[:-3] + 'e', chinese_dict[word[:-3] + 'e']))
    elif word.endswith('ed') and word[:-2] in chinese_dict:
        potential_matches.append((word, word[:-2], chinese_dict[word[:-2]]))
    elif word.endswith('ed') and word[:-1] in chinese_dict:
        potential_matches.append((word, word[:-1], chinese_dict[word[:-1]]))

if potential_matches:
    print(f"\n   发现 {len(potential_matches)} 个词形变化导致的未匹配:")
    for word, base, translation in potential_matches:
        print(f"   {word:20} → 基础形式: {base} ({translation})")
else:
    print("   未发现明显的词形变化问题")

print(f"\n📝 建议 Recommendations:")
if potential_matches:
    print(f"   1. 词典中添加词形变化 (复数、动词变位等)")
    print(f"   2. 或在前端实现词干提取 (stemming)")
if len(no_chinese) - len(potential_matches) > 0:
    print(f"   3. 补充缺失的 {len(no_chinese) - len(potential_matches)} 个基础词汇")

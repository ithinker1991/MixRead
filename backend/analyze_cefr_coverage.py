#!/usr/bin/env python3
"""
分析 CEFR 数据库中有多少词缺少中文翻译
Analyze how many CEFR words are missing Chinese translations
"""

import json
from pathlib import Path

# Load CEFR database
cefr_path = Path(__file__).parent / "data" / "cefr_words.json"
with open(cefr_path, 'r', encoding='utf-8') as f:
    cefr_data = json.load(f)

# Load Chinese dictionary
chinese_path = Path(__file__).parent / "chinese_dict.json"
with open(chinese_path, 'r', encoding='utf-8') as f:
    chinese_dict = json.load(f)

print("📊 CEFR 词库与中文词典覆盖率分析")
print("=" * 60)

# Count by CEFR level
levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
total_words = 0
total_with_chinese = 0

level_stats = {}

for level in levels:
    level_words = [w for w in cefr_data if cefr_data[w].get('cefr_level') == level]
    words_with_chinese = [w for w in level_words if w.lower() in chinese_dict]

    level_stats[level] = {
        'total': len(level_words),
        'with_chinese': len(words_with_chinese),
        'coverage': len(words_with_chinese) / len(level_words) * 100 if level_words else 0,
        'missing': [w for w in level_words[:20] if w.lower() not in chinese_dict]  # Sample
    }

    total_words += len(level_words)
    total_with_chinese += len(words_with_chinese)

    print(f"\n{level} 级别:")
    print(f"  总词数: {len(level_words)}")
    print(f"  有中文: {len(words_with_chinese)} ({level_stats[level]['coverage']:.1f}%)")
    print(f"  缺少中文: {len(level_words) - len(words_with_chinese)}")
    if level_stats[level]['missing']:
        print(f"  示例缺失词: {', '.join(level_stats[level]['missing'][:10])}")

print(f"\n{'='*60}")
print(f"总计:")
print(f"  CEFR 总词数: {total_words}")
print(f"  有中文: {total_with_chinese} ({total_with_chinese/total_words*100:.1f}%)")
print(f"  缺少中文: {total_words - total_with_chinese}")

print(f"\n{'='*60}")
print("💡 建议 Recommendations:")
print()
print("1. 最简单：扩充中文词典到常用的 1000-2000 词")
print("2. 完整覆盖：添加所有 CEFR 词的翻译 (6860 词)")
print("3. 智能方案：使用翻译 API 作为备选")
print("4. 混合方案：A1-B1 完整覆盖，B2-C2 使用 API 备选")

# Find most common missing words in B1 and below (should prioritize these)
common_levels = ['A1', 'A2', 'B1']
common_missing = []
for level in common_levels:
    level_words = [w for w in cefr_data if cefr_data[w].get('cefr_level') == level]
    missing = [w.lower() for w in level_words if w.lower() not in chinese_dict]
    common_missing.extend(missing)

print(f"\n{'='*60}")
print(f"🎯 高优先级缺失词汇 (A1-B1):")
print(f"   总数: {len(common_missing)} 个")
if common_missing:
    print(f"   前 50 个: {', '.join(sorted(set(common_missing))[:50])}")

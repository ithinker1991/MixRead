#!/usr/bin/env python3
"""
添加缺失的单词（词形变化 + 常用词）
Add missing words (word forms + common words)
"""

import json
from pathlib import Path

# Load existing dictionary
dict_path = Path(__file__).parent / "chinese_dict.json"
with open(dict_path, 'r', encoding='utf-8') as f:
    chinese_dict = json.load(f)

print(f"📚 当前词典: {len(chinese_dict)} 个单词")

# Add missing word forms and common words
new_words = {
    # Word forms from test paragraph
    "challenges": "挑战",
    "effects": "影响",
    "patterns": "模式",
    "requires": "需要",

    # Additional word forms for existing words
    "technologies": "技术",
    "observations": "观察",
    "measurements": "测量",
    "evaluations": "评估",
    "investigations": "调查",
    "explorations": "探索",
    "applications": "应用",
    "definitions": "定义",
    "examples": "例子",
    "sentences": "句子",
    "systems": "系统",
    "processes": "过程",
    "methods": "方法",
    "approaches": "方法",
    "strategies": "策略",
    "solutions": "解决方案",
    "problems": "问题",
    "opportunities": "机会",
    "emissions": "排放",

    # Missing content words from test paragraph
    "humanity": "人类",
    "documented": "记录的",
    "domains": "领域",
    "environmental": "环境的",
    "facing": "面对",
    "increasingly": "日益",
    "international": "国际的",
    "observe": "观察",
    "represents": "代表",
    "scientists": "科学家",
    "urgent": "紧急的",
    "becoming": "变得",
    "act": "行动",

    # Additional common words
    "across": "横跨",
    "including": "包括",
    "these": "这些",
    "most": "最",
    "one": "一个",

    # More verb forms
    "requires": "需要",
    "provides": "提供",
    "includes": "包括",
    "contains": "包含",
    "involves": "涉及",
    "affects": "影响",
    "influences": "影响",
    "determines": "决定",
    "establishes": "建立",
    "maintains": "维持",
    "improves": "改善",
    "enhances": "增强",
    "increases": "增加",
    "decreases": "减少",
    "reduces": "减少",
    "expands": "扩展",
    "extends": "延伸",
    "limits": "限制",
    "restricts": "限制",
    "prevents": "防止",

    # Adjective forms
    "various": "各种各样的",
    "specific": "具体的",
    "general": "一般的",
    "common": "常见的",
    "typical": "典型的",
    "unique": "独特的",
    "special": "特殊的",
}

# Merge with existing dictionary
added_count = 0
for word, translation in new_words.items():
    if word not in chinese_dict:
        chinese_dict[word] = translation
        added_count += 1
        print(f"  ✅ 添加: {word} → {translation}")
    else:
        print(f"  ⏭️  已存在: {word}")

# Save updated dictionary
with open(dict_path, 'w', encoding='utf-8') as f:
    json.dump(chinese_dict, f, ensure_ascii=False, indent=2)

print(f"\n✅ 更新完成!")
print(f"   新增: {added_count} 个单词")
print(f"   总计: {len(chinese_dict)} 个单词")

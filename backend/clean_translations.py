#!/usr/bin/env python3
"""
清理中文翻译，只保留最核心的释义
- 去除多余释义（只保留第一个）
- 去除脏数据
- 限制长度（最多2个词）
"""

import json
import re
from pathlib import Path

def clean_translation(text: str) -> str:
    """
    清理翻译文本，返回最简洁的版本
    """
    if not text:
        return ""

    # Remove CSV artifacts (anything after ",, or "",)
    text = re.split(r'[",]{2,}', text)[0]

    # Remove extra whitespace
    text = text.strip()

    # Split by common separators
    for sep in [',', '，', ';', '；', '、']:
        if sep in text:
            parts = [p.strip() for p in text.split(sep) if p.strip()]
            if parts:
                text = parts[0]  # Take first meaning
                break

    # Limit length: prefer shorter translations
    # If too long (>6 chars), try to find a shorter alternative
    if len(text) > 6:
        # Check if there are parentheses or brackets
        text = re.sub(r'\([^)]*\)', '', text)  # Remove (...)
        text = re.sub(r'\[[^\]]*\]', '', text)  # Remove [...]
        text = text.strip()

    # Remove any remaining non-Chinese characters at the end
    text = re.sub(r'[^\\u4e00-\\u9fa5]+$', '', text)

    return text.strip()


def clean_dictionary():
    """
    清理整个词典
    """
    dict_path = Path(__file__).parent / "chinese_dict.json"

    print("=" * 70)
    print("🧹 清理中文词典")
    print("=" * 70)

    # Load dictionary
    with open(dict_path, 'r', encoding='utf-8') as f:
        original_dict = json.load(f)

    print(f"\n📚 原词典: {len(original_dict)} 词")

    # Clean each entry
    cleaned_dict = {}
    problematic = []
    cleaned_count = 0

    for word, translation in original_dict.items():
        cleaned = clean_translation(translation)

        if not cleaned:
            problematic.append(word)
            continue

        if cleaned != translation:
            cleaned_count += 1
            if cleaned_count <= 10:  # Show first 10 examples
                print(f"\n清理示例:")
                print(f"  {word}")
                print(f"    原文: {translation[:50]}{'...' if len(translation) > 50 else ''}")
                print(f"    清理: {cleaned}")

        cleaned_dict[word] = cleaned

    print(f"\n✅ 清理完成:")
    print(f"   原词数: {len(original_dict)}")
    print(f"   清理数: {cleaned_count}")
    print(f"   问题词: {len(problematic)}")
    print(f"   保留词: {len(cleaned_dict)}")

    if problematic:
        print(f"\n⚠️  以下词汇没有有效翻译，已移除:")
        for word in problematic[:20]:  # Show first 20
            print(f"   - {word}")
        if len(problematic) > 20:
            print(f"   ... 和其他 {len(problematic) - 20} 个词")

    # Save cleaned dictionary
    with open(dict_path, 'w', encoding='utf-8') as f:
        json.dump(cleaned_dict, f, ensure_ascii=False, indent=2)

    print(f"\n💾 已保存到: {dict_path}")

    # Show some examples
    print(f"\n📋 清理后的示例:")
    examples = ['philosophy', 'flexible', 'curve', 'beautiful', 'climate', 'technology']
    for word in examples:
        if word in cleaned_dict:
            print(f"   {word:15} → {cleaned_dict[word]}")

    # Statistics
    print(f"\n📊 翻译长度统计:")
    lengths = [len(t) for t in cleaned_dict.values()]
    print(f"   平均长度: {sum(lengths) / len(lengths):.1f} 字符")
    print(f"   最短: {min(lengths)} 字符")
    print(f"   最长: {max(lengths)} 字符")

    # Count by length
    length_dist = {}
    for length in lengths:
        length_dist[length] = length_dist.get(length, 0) + 1

    print(f"\n   长度分布:")
    for length in sorted(length_dist.keys())[:10]:  # Show first 10
        count = length_dist[length]
        percent = count / len(cleaned_dict) * 100
        bar = '█' * int(percent / 2)
        print(f"   {length}字符: {bar} {count} ({percent:.1f}%)")

    return cleaned_dict


if __name__ == "__main__":
    clean_dictionary()

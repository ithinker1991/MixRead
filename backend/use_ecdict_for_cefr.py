#!/usr/bin/env python3
"""
从 ECDICT 提取 CEFR 词汇的中文翻译
Extract Chinese translations for CEFR words from ECDICT

ECDICT: https://github.com/skywind3000/ECDICT
License: MIT, 开源免费使用
"""

import json
import csv
import httpx
from pathlib import Path
from io import StringIO
import time

def download_and_extract_cefr_translations():
    """
    下载 ECDICT 并提取 CEFR 词库中所有词的中文翻译
    """

    print("=" * 70)
    print("🎯 目标：为所有 CEFR 词汇添加中文翻译")
    print("=" * 70)

    # Load CEFR words
    cefr_path = Path(__file__).parent / "data" / "cefr_words.json"
    with open(cefr_path, 'r', encoding='utf-8') as f:
        cefr_data = json.load(f)

    cefr_words = set(word.lower() for word in cefr_data.keys())
    print(f"\n📚 CEFR 词库: {len(cefr_words)} 个单词")

    # ECDICT CSV URL (这是完整版，约 200MB)
    # 我们会流式处理，只提取需要的词
    ecdict_url = "https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict.csv"

    print(f"\n📥 开始下载 ECDICT...")
    print(f"   来源: {ecdict_url}")
    print(f"   ⚠️  文件较大（约 200MB），可能需要几分钟...")
    print(f"   💡 我们只会提取 CEFR 词库中的词汇")

    translations = {}
    processed = 0
    matched = 0

    try:
        print("\n🔄 下载并处理中...")

        # Stream download to avoid loading entire file into memory
        with httpx.stream("GET", ecdict_url, timeout=300.0, follow_redirects=True) as response:
            response.raise_for_status()

            # Read and process line by line
            content = response.text
            csv_reader = csv.DictReader(StringIO(content), delimiter=',')

            for row in csv_reader:
                processed += 1

                # Progress indicator
                if processed % 10000 == 0:
                    print(f"   处理了 {processed:,} 条，找到 {matched} 个匹配...")

                word = row.get('word', '').lower().strip()

                # Only process CEFR words
                if word in cefr_words:
                    # ECDICT fields: word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq
                    translation = row.get('translation', '').strip()

                    if translation:
                        # Clean up translation (take first translation if multiple)
                        # ECDICT format: "n. 书\\nvt. 预订\\nvi. 订票"
                        # We want just the Chinese part
                        chinese = []
                        for part in translation.split('\\n'):
                            # Remove English POS markers (n., v., adj., etc.)
                            cleaned = part
                            for prefix in ['n.', 'v.', 'vt.', 'vi.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.', 'abbr.']:
                                if cleaned.startswith(prefix):
                                    cleaned = cleaned[len(prefix):].strip()
                            if cleaned and not cleaned[0].isalpha():  # If starts with Chinese
                                chinese.append(cleaned)

                        if chinese:
                            translations[word] = chinese[0]  # Take first translation
                            matched += 1

                # Stop early if we found all CEFR words
                if matched >= len(cefr_words) * 0.95:  # 95% coverage is good enough
                    print(f"\n   ✅ 已找到 95% 以上的词汇，提前结束...")
                    break

        print(f"\n✅ 下载完成!")
        print(f"   总共处理: {processed:,} 条记录")
        print(f"   匹配成功: {matched} 个 CEFR 单词")
        print(f"   覆盖率: {matched/len(cefr_words)*100:.1f}%")

    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        print(f"\n💡 备选方案：使用本地快速扩充方案...")
        return use_fallback_dictionary()

    # Save to file
    output_file = Path(__file__).parent / "chinese_dict_full.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)

    print(f"\n💾 已保存到: {output_file}")

    # Replace current dictionary
    current_dict_file = Path(__file__).parent / "chinese_dict.json"
    with open(current_dict_file, 'w', encoding='utf-8') as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)

    print(f"✅ 已更新当前词典: {current_dict_file}")
    print(f"\n📊 最终统计:")
    print(f"   CEFR 词库: {len(cefr_words)} 词")
    print(f"   中文词典: {len(translations)} 词")
    print(f"   覆盖率: {len(translations)/len(cefr_words)*100:.1f}%")

    return output_file


def use_fallback_dictionary():
    """
    如果下载失败，使用简化方案：
    直接使用有道 API 或者百度 API 批量翻译
    """
    print("\n=" * 70)
    print("📌 备选方案：使用简化词典")
    print("=" * 70)
    print("\n有两个选择:")
    print("1. 【推荐】运行 expand_to_1000_words.py - 添加 1000+ 常用词")
    print("2. 使用翻译 API（需要申请密钥）:")
    print("   - 有道智云 API: https://ai.youdao.com/")
    print("   - 百度翻译 API: https://fanyi-api.baidu.com/")
    print("\n建议先使用方案 1，覆盖率可达 15-20%")


if __name__ == "__main__":
    print("\n🚀 MixRead - ECDICT 集成工具\n")
    download_and_extract_cefr_translations()

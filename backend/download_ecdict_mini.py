#!/usr/bin/env python3
"""
下载 ECDICT Mini 版本（更小，更快）
然后提取 CEFR 词汇的中文翻译
"""

import json
import csv
import httpx
from pathlib import Path
from io import StringIO

def download_ecdict_mini():
    """
    下载 ECDICT Mini 版本并提取 CEFR 词汇翻译
    """

    print("=" * 70)
    print("🎯 下载 ECDICT Mini 版本")
    print("=" * 70)

    # Load CEFR words
    cefr_path = Path(__file__).parent / "data" / "cefr_words.json"
    with open(cefr_path, 'r', encoding='utf-8') as f:
        cefr_data = json.load(f)

    cefr_words = set(word.lower() for word in cefr_data.keys())
    print(f"\n📚 CEFR 词库: {len(cefr_words)} 个单词")

    # ECDICT Mini URL (smaller file, faster download)
    mini_url = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.mini.csv"

    print(f"\n📥 下载 ECDICT Mini...")
    print(f"   来源: {mini_url}")
    print(f"   ⏱  预计时间: 30-60 秒")

    translations = {}
    processed = 0
    matched = 0

    try:
        print("\n🔄 下载中...")

        # Download the file
        with httpx.Client(timeout=120.0) as client:
            response = client.get(mini_url, follow_redirects=True)
            response.raise_for_status()

            print("✅ 下载完成，开始处理...")

            # Parse CSV
            content = response.text
            csv_reader = csv.DictReader(StringIO(content), delimiter=',')

            for row in csv_reader:
                processed += 1

                if processed % 5000 == 0:
                    print(f"   处理了 {processed:,} 条，找到 {matched} 个匹配...")

                word = row.get('word', '').lower().strip()

                # Only process CEFR words
                if word in cefr_words:
                    translation = row.get('translation', '').strip()

                    if translation:
                        # Clean up translation
                        chinese = extract_chinese(translation)
                        if chinese:
                            translations[word] = chinese
                            matched += 1

        print(f"\n✅ 处理完成!")
        print(f"   总共处理: {processed:,} 条记录")
        print(f"   匹配成功: {matched} 个 CEFR 单词")
        print(f"   覆盖率: {matched/len(cefr_words)*100:.1f}%")

    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        print("\n使用备选方案...")
        return use_stardict_format()

    # Merge with existing dictionary (keep manual entries)
    existing_dict_file = Path(__file__).parent / "chinese_dict.json"
    try:
        with open(existing_dict_file, 'r', encoding='utf-8') as f:
            existing_dict = json.load(f)
        print(f"\n📖 当前词典: {len(existing_dict)} 词")

        # Merge: prefer existing manual translations
        for word, translation in translations.items():
            if word not in existing_dict:
                existing_dict[word] = translation

        translations = existing_dict
        print(f"   合并后: {len(translations)} 词")

    except FileNotFoundError:
        pass

    # Save to file
    output_file = Path(__file__).parent / "chinese_dict.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)

    print(f"\n💾 已保存到: {output_file}")
    print(f"\n📊 最终统计:")
    print(f"   CEFR 词库: {len(cefr_words)} 词")
    print(f"   中文词典: {len(translations)} 词")
    print(f"   覆盖率: {len(translations)/len(cefr_words)*100:.1f}%")

    # Show coverage by level
    show_coverage_by_level(translations, cefr_data)

    return output_file


def extract_chinese(translation: str) -> str:
    """
    从 ECDICT 翻译字段中提取中文
    格式例子: "n. 书\\nvt. 预订\\nvi. 订票"
    """
    if not translation:
        return ""

    chinese_parts = []
    for part in translation.split('\\n'):
        # Remove English POS markers
        cleaned = part.strip()
        for prefix in ['n.', 'v.', 'vt.', 'vi.', 'adj.', 'adv.', 'prep.',
                       'conj.', 'pron.', 'interj.', 'abbr.', 'num.', 'art.']:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
                break

        # Check if starts with Chinese character
        if cleaned and ord(cleaned[0]) > 127:  # Non-ASCII (likely Chinese)
            chinese_parts.append(cleaned)

    # Return first valid Chinese translation
    return chinese_parts[0] if chinese_parts else ""


def show_coverage_by_level(translations: dict, cefr_data: dict):
    """显示各难度级别的覆盖率"""
    levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

    print(f"\n📈 各级别覆盖率:")
    for level in levels:
        level_words = [w for w in cefr_data if cefr_data[w].get('cefr_level') == level]
        if not level_words:
            continue

        covered = sum(1 for w in level_words if w.lower() in translations)
        coverage = covered / len(level_words) * 100 if level_words else 0

        print(f"   {level}: {covered}/{len(level_words)} ({coverage:.1f}%)")


def use_stardict_format():
    """备选方案：使用 StarDict 格式或其他来源"""
    print("\n=" * 70)
    print("📌 备选方案")
    print("=" * 70)
    print("\n推荐使用翻译 API:")
    print("1. 有道智云 API (免费额度 100次/天)")
    print("2. 百度翻译 API (标准版免费)")
    print("\n或者使用当前的 1708 词词典继续。")
    return None


if __name__ == "__main__":
    download_ecdict_mini()

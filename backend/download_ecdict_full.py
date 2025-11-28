#!/usr/bin/env python3
"""
下载完整 ECDICT 并提取 CEFR 词汇翻译
使用流式处理，避免内存溢出
"""

import json
import csv
from pathlib import Path
import requests  # 使用 requests 替代 httpx 以获得更好的流式支持

def download_ecdict_full():
    """
    流式下载完整 ECDICT
    """

    print("=" * 70)
    print("🎯 下载完整 ECDICT (约 770K 词条)")
    print("=" * 70)

    # Load CEFR words
    cefr_path = Path(__file__).parent / "data" / "cefr_words.json"
    with open(cefr_path, 'r', encoding='utf-8') as f:
        cefr_data = json.load(f)

    cefr_words = set(word.lower() for word in cefr_data.keys())
    print(f"\n📚 CEFR 词库: {len(cefr_words)} 个单词")

    # Full ECDICT URL
    full_url = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"

    print(f"\n📥 开始下载完整 ECDICT...")
    print(f"   来源: {full_url}")
    print(f"   ⏱  预计时间: 2-5 分钟（取决于网速）")
    print(f"   💡 使用流式处理，不会占用太多内存")

    translations = {}
    processed = 0
    matched = 0

    try:
        print("\n🔄 下载并处理中（请耐心等待）...\n")

        # Stream download
        with requests.get(full_url, stream=True, timeout=300) as response:
            response.raise_for_status()

            # Decode and process line by line
            lines = response.iter_lines(decode_unicode=True)

            # Get header
            header_line = next(lines)
            fieldnames = header_line.split(',')

            # Find indices for columns we need
            word_idx = fieldnames.index('word')
            trans_idx = fieldnames.index('translation')

            # Process each line
            for line in lines:
                if not line.strip():
                    continue

                processed += 1

                # Progress indicator
                if processed % 10000 == 0:
                    print(f"   ✓ 处理了 {processed:,} 条，找到 {matched}/{len(cefr_words)} 个匹配 ({matched/len(cefr_words)*100:.1f}%)")

                try:
                    # Simple CSV parsing (handle basic cases)
                    parts = line.split(',')
                    if len(parts) < max(word_idx, trans_idx) + 1:
                        continue

                    word = parts[word_idx].strip().strip('"').lower()
                    translation = ','.join(parts[trans_idx:]).strip().strip('"')

                    # Only process CEFR words
                    if word in cefr_words and translation:
                        chinese = extract_chinese(translation)
                        if chinese and word not in translations:  # Don't overwrite
                            translations[word] = chinese
                            matched += 1

                            # Early exit if we found most words
                            if matched >= len(cefr_words) * 0.98:  # 98% is excellent
                                print(f"\n   🎉 达到 98% 覆盖率，提前结束...")
                                break

                except Exception as e:
                    # Skip problematic lines
                    continue

        print(f"\n✅ 下载并处理完成!")
        print(f"   总共处理: {processed:,} 条记录")
        print(f"   匹配成功: {matched} 个 CEFR 单词")
        print(f"   覆盖率: {matched/len(cefr_words)*100:.1f}%")

    except requests.exceptions.RequestException as e:
        print(f"\n❌ 下载失败: {e}")
        print("\n💡 可能的原因:")
        print("   - 网络连接问题")
        print("   - GitHub 访问受限")
        print("\n建议:")
        print("   1. 检查网络连接")
        print("   2. 使用 VPN 或镜像")
        print("   3. 或使用当前 1708 词词典")
        return None

    # Merge with existing dictionary
    existing_dict_file = Path(__file__).parent / "chinese_dict.json"
    try:
        with open(existing_dict_file, 'r', encoding='utf-8') as f:
            existing_dict = json.load(f)
        print(f"\n📖 当前词典: {len(existing_dict)} 词")

        # Merge: prefer existing manual translations
        added = 0
        for word, translation in translations.items():
            if word not in existing_dict:
                existing_dict[word] = translation
                added += 1

        translations = existing_dict
        print(f"   新增: {added} 词")
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

    print(f"\n🎉 完成！现在你的词典覆盖率大幅提升！")
    print(f"   建议：重启后端以加载新词典")

    return output_file


def extract_chinese(translation: str) -> str:
    """
    从 ECDICT 翻译字段中提取中文
    优化：只保留第一个、最简洁的释义
    """
    if not translation:
        return ""

    # First, remove any CSV artifacts (trailing commas and fields)
    translation = translation.split(',,')[0].strip()

    chinese_parts = []

    # Split by common separators to get multiple meanings
    for separator in ['\\n', '\n', '；', ';']:
        if separator in translation:
            translation = translation.replace(separator, '|')

    for part in translation.split('|'):
        cleaned = part.strip()

        # Remove English POS markers (n., v., adj., etc.)
        for prefix in ['n.', 'v.', 'vt.', 'vi.', 'adj.', 'adv.', 'prep.',
                       'conj.', 'pron.', 'interj.', 'abbr.', 'num.', 'art.',
                       'a.', 'aux.', 'det.', 'modal.', 'inf.']:
            if cleaned.lower().startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
                break

        # Check if starts with Chinese character
        if cleaned and len(cleaned) > 0:
            first_char = cleaned[0]
            # Check if Chinese (CJK Unified Ideographs range)
            if '\u4e00' <= first_char <= '\u9fff':
                # Keep only the first meaning (before comma)
                cleaned = cleaned.split(',')[0].strip()
                cleaned = cleaned.split('，')[0].strip()

                # Remove parentheses and brackets content
                cleaned = cleaned.split('(')[0].strip()
                cleaned = cleaned.split('（')[0].strip()
                cleaned = cleaned.split('[')[0].strip()

                if cleaned and len(cleaned) <= 8:  # Prefer concise translations
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

        bar_length = int(coverage / 2)  # Scale to 50 chars max
        bar = '█' * bar_length + '░' * (50 - bar_length)

        print(f"   {level}: {bar} {covered}/{len(level_words)} ({coverage:.1f}%)")


if __name__ == "__main__":
    download_ecdict_full()

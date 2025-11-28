import json

# 加载词典
with open('backend/chinese_dict.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

# 测试段落中的词
test_words = """
climate change represents consequential challenges facing humanity
ramifications extend domains including agriculture infrastructure biodiversity
scientists documented unprecedented temperature fluctuations volatile weather patterns
mitigating effects requires comprehensive international cooperation substantial
investment sustainable technologies imperative becoming increasingly urgent
observe accelerating environmental degradation
""".lower().split()

print(f"词典大小: {len(d)}")
print(f"\n测试段落中的词汇覆盖:")
print("-" * 60)

found = 0
not_found = []

for word in sorted(set(test_words)):
    if word in d:
        print(f"✓ {word:20} → {d[word]}")
        found += 1
    else:
        print(f"✗ {word:20} (无翻译)")
        not_found.append(word)

print(f"\n覆盖率: {found}/{len(set(test_words))} = {found/len(set(test_words))*100:.1f}%")
print(f"\n缺失的词: {', '.join(not_found)}")

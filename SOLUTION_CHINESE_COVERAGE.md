# 解决方案：保证高亮的都有中文

生成时间: 2025-11-28

## ✅ 已实现：只高亮有中文的词

### 问题
- CEFR 词库 6860 词，中文词典只有几百词
- 很多词被高亮但没有中文翻译

### 解决方案
修改后端逻辑 + 扩充词典

**1. 后端修改（backend/main.py）**
```python
# /highlight-words 端点现在会检查：
# 1. 单词难度符合要求
# 2. 单词有中文翻译

if should_highlight_word(word, batch.difficulty_level):
    chinese = chinese_dict.get(word.lower())

    # 只高亮有中文的词
    if chinese:
        highlighted.append(word)
```

**2. 词典扩充**
- 从 299 词 → **1708 词** (+1409)
- A1 级别覆盖率：81.8%
- 总体覆盖率：23.3%

## 📊 当前状态

| 指标 | 数值 |
|------|------|
| 中文词典 | 1708 词 |
| CEFR 总词库 | 6860 词 |
| 总体覆盖率 | 23.3% |
| A1 覆盖率 | 81.8% |
| A2 覆盖率 | 37.5% |
| B1 覆盖率 | 13.7% |
| B2 覆盖率 | 5.1% |

## 🎯 效果

**保证：100% 高亮的词都有中文！**

- 以前：高亮 100 个词，可能只有 20 个有中文
- 现在：高亮 50 个词，**全部** 都有中文

**权衡：**
- ✅ 优点：每个高亮词都有中文，用户体验一致
- ⚠️  缺点：高亮词数量减少（但更精准）

## 🚀 三个提升覆盖率的方案

### 方案 A：下载完整 ECDICT（推荐，免费）

**覆盖率：预计 90%+**

```bash
cd backend
python use_ecdict_for_cefr.py
```

这会下载 ECDICT 开源词典（200MB），提取所有 CEFR 词汇的中文。

**优点：**
- 免费开源（MIT 许可）
- 一次性下载，永久使用
- 预计覆盖 90%+ 的 CEFR 词汇

**缺点：**
- 需要下载 200MB（几分钟）
- 需要网络连接

### 方案 B：继续手动扩充词典

**覆盖率：可达 40-50%**

继续添加常用词到 `chinese_dict.json`

```bash
cd backend
# 编辑 expand_to_1000_words.py 添加更多词
python expand_to_1000_words.py
```

**优点：**
- 完全掌控词库质量
- 可以针对特定领域（如技术、商业）

**缺点：**
- 需要手动维护
- 覆盖率有限

### 方案 C：使用翻译 API 备选（最彻底）

**覆盖率：100%**

当词典没有时，调用翻译 API：

**免费 API 选项：**
1. **Google Translate (非官方)** - 免费但不稳定
2. **有道智云** - 有免费额度（100次/天）
3. **百度翻译** - 有免费额度（标准版）

**实现步骤：**
```python
# backend/main.py 添加
async def get_chinese_translation(word: str) -> str:
    # 1. 先查词典
    if word.lower() in chinese_dict:
        return chinese_dict[word.lower()]

    # 2. 词典没有，调用 API
    translation = await call_translation_api(word)

    # 3. 缓存结果
    chinese_dict[word.lower()] = translation
    return translation
```

**优点：**
- 100% 覆盖率
- 自动学习（缓存新翻译）

**缺点：**
- 需要 API 密钥
- 有请求限制
- 需要网络连接

## 🎨 推荐方案组合

**阶段 1（当前）：** ✅
- 1708 词手动词典
- 只高亮有中文的词
- A1 级别 82% 覆盖率

**阶段 2（建议）：**
- 下载 ECDICT（方案 A）
- 覆盖率提升到 90%+
- 运行一次，永久使用

**阶段 3（可选）：**
- 添加翻译 API 备选（方案 C）
- 实现 100% 覆盖率
- 处理专有名词和新词

## 📝 使用说明

### 立即生效（已完成）

1. **重启后端**
```bash
cd backend
source venv/bin/activate
python main.py
# 看到：Loaded 1708 Chinese translations
```

2. **重新加载扩展**
- 打开 `chrome://extensions`
- 移除 MixRead 扩展
- 重新加载 `frontend` 文件夹

3. **测试**
访问任意英文网页，现在：
- 所有高亮词都有中文 ✅
- 高亮词数量可能减少（更精准）

### 下一步（可选，建议）

运行 ECDICT 下载脚本：
```bash
cd backend
python use_ecdict_for_cefr.py
```

这会提升覆盖率到 90%+，更多词被高亮。

## 🔍 技术细节

### 后端修改
文件：`backend/main.py`
位置：第 163-190 行

```python
# 修改前：所有符合难度的词都高亮
if should_highlight_word(word, batch.difficulty_level):
    highlighted.append(word)

# 修改后：必须同时符合难度且有中文
if should_highlight_word(word, batch.difficulty_level):
    chinese = chinese_dict.get(word.lower())
    if chinese:  # 新增检查
        highlighted.append(word)
```

### 词典文件
- 位置：`backend/chinese_dict.json`
- 大小：1708 词
- 格式：`{"word": "中文翻译"}`

### 覆盖率分析工具
```bash
cd backend
python analyze_cefr_coverage.py
```

显示各难度级别的覆盖率统计。

## ❓ FAQ

**Q: 为什么高亮的词变少了？**
A: 因为现在只高亮有中文的词。这是设计选择：宁可少而精，不要多而杂。

**Q: 如何增加高亮词数量？**
A: 运行 `use_ecdict_for_cefr.py` 扩充词典到 90%+ 覆盖率。

**Q: A1 级别为什么覆盖率高？**
A: 因为 A1 是最基础词汇，我们的 1708 词主要覆盖 A1-A2。

**Q: B2 以上覆盖率很低怎么办？**
A: B2-C2 是高级词汇，建议：
1. 下载 ECDICT（推荐）
2. 使用翻译 API 备选
3. 或者接受较低覆盖率（高级学习者可能不需要太多翻译）

**Q: 会影响性能吗？**
A: 不会。检查是否有中文只是一个字典查找，非常快（O(1)）。

## 📈 后续改进

1. **词干提取**
   - 自动匹配词形变化（reading → read）
   - 提升实际覆盖率

2. **用户反馈**
   - 允许用户报告缺失翻译
   - 众包补充词典

3. **智能缓存**
   - 记录高频词汇
   - 优先翻译常用词

4. **多语言支持**
   - 日语、韩语等
   - 用户可选目标语言

---

**总结：问题已解决！所有高亮词现在都有中文翻译。✅**

生成时间: 2025-11-28
版本: 1708-word dictionary + filtering logic

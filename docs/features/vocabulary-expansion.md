# Vocabulary Expansion (词汇扩展)

**Status**: Phase 2 (In Progress)
**Last Updated**: 2025-11-29

---

## 1. Progress Summary (进度总结)

| 指标              | 初始值 | 当前值 | 增长           |
| ----------------- | ------ | ------ | -------------- |
| **CEFR 词汇总数** | 6,860  | 7,234  | +374 (+5.4%)   |
| **中文翻译覆盖**  | 800    | 6,504  | +5,704 (+712%) |
| **覆盖率**        | 11.6%  | 89.9%  | -              |

### CEFR Distribution (难度分布)

- **A1**: 1,020 词 (14.1%)
- **A2**: 1,155 词 (16.0%)
- **B1**: 2,302 词 (31.8%)
- **B2**: 2,757 词 (38.1%)

---

## 2. Static Dictionary Data Structure (静态词典数据结构)

新的词汇数据结构 (Version 2.0) 支持多维度的考试标记和频率排名。
**注意**: 这些数据存储在 `backend/data/cefr_words.json` 中，而非数据库。

```json
{
  "word": {
    "pos": "noun",
    "cefr_level": "B2",
    "frequency_rank": 5234,
    "chinese": "熟练度",
    "exams": {
      "cet4": false,
      "cet6": true,
      "ielts": 6.0,
      "toefl": 70,
      "gre": false
    }
  }
}
```

### Fields Description

- **frequency_rank**: 词频排名 (基于 BNC/COCA 语料库)。
- **exams**: 考试标记对象。
  - `cet4`/`cet6`: bool, 是否为四六级词汇。
  - `ielts`: float, 雅思推荐分数 (0-9)。
  - `toefl`: int, 托福推荐分数 (0-120)。

---

## 3. Expansion Strategy (扩展策略)

### 方案 E: 混合方案 (Hybrid Approach) - **Selected**

我们采用 **本地核心库 + 动态 API 缓存** 的混合模式。

1.  **短期 (Week 1)**:

    - 合并 BNC/COCA 前 10,000 高频词。
    - 目标词汇量: 18,000+。
    - 补充中文翻译。

2.  **中期 (Week 2-3)**:

    - 引入 `cached_words` 数据库表。
    - 实现本地未命中时，查询 Free Dictionary API 并缓存。

3.  **长期**:
    - 支持无限词汇查询。
    - AI 辅助难度定级。

---

## 4. Next Steps (下一步)

1.  [ ] **Batch Import**: 导入 BNC/COCA 词汇表。
2.  [ ] **Translation**: 补充剩余 10% 的中文翻译。
3.  [ ] **Exam Tags**: 完善 CET-4/6 和 IELTS 标记。
4.  [ ] **API**: 开发 `/exam-words` 接口支持按考试筛选。

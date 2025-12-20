# Vocabulary Expansion & Difficulty System (词汇扩展与难度系统)

**Status**: Phase 2 (Planning)
**Last Updated**: 2025-12-20

---

## 1. Core Philosophy (核心理念)

为了实现"更加流畅阅读，尽可能避免查词"的目标，我们的系统设计遵循以下原则：

1.  **覆盖核心高频词**：静态内置 Top 20,000 高频词，覆盖 95%+ 的日常阅读需求，保证极速响应。
2.  **长尾词汇混合处理 (Hybrid)**：对于 Top 20,000 以外的低频词（长尾词），采用"本地缓存 + 实时查询"的混合模式。**决不因为词库未收录而不展示释义**，确保用户无障碍阅读。
3.  **统一难度量表 (Unified Level)**：打破 CEFR/托福/雅思的壁垒，建立统一的 **0-100 难度分值**。用户既可以选 "B1"，也可以选 "托福 80 分"，系统自动转换为内部统一分值进行处理。

---

## 2. Vocabulary Data Structure (词汇数据结构)

我们构建一个分层的词汇系统：

### Tier 1: Core Static Library (核心静态库) - Top 30,000

- **来源**: ECDICT (基于 BNC/COCA 词频筛选 Top 30,000)
- **存储**: 本地 JSON 文件 (约 8-10MB，加载至内存)
- **内容**: 包含完整释义、词频、CEFR 等级、考试标签。
- **作用**: 毫秒级响应，支持主要阅读体验。覆盖 98%+ 阅读需求。
- **配置**: 词库大小只需修改筛选脚本参数即可轻松调整 (e.g. 20k -> 50k)。

### Tier 2: Dynamic Extended Library (动态扩展库) - Infinite (770k+)

- **来源**: 完整 ECDICT 数据库 (sqlite/server) + 用户历史查询
- **存储**: `mixread.db` (SQLite)
- **机制**:
  - 当用户请求 Top 30,000 以外的词时，先查本地缓存 DB。
  - 若本地 DB (Tier 1) 未命中，查询 Tier 2 (SQLite Full DB)。
  - **全量兜底**: 确保任何冷门词汇 (Tier 2) 都能被查到，只是不做高亮推荐。
- **作用**: 覆盖专业词汇、生僻词，确保"所有词皆可查"。

---

## 3. Unified Difficulty System (统一难度系统)

引入 **MixRead Level (MRS - MixRead Score)**，范围 0-100+。

### 3.1 难度映射表 (Mapping Reference)

我们将不同的标准统一映射到 MRS：

| MRS Score    | CEFR   | 词频排名 (Rank) | 对应考试水平 (参考)   | 描述                     |
| :----------- | :----- | :-------------- | :-------------------- | :----------------------- |
| **0 - 20**   | **A1** | Top 1,000       | 小学/初中             | 极基础词汇 (the, is, go) |
| **20 - 40**  | **A2** | 1,000 - 3,000   | 中考/高考基础         | 基础日常交流             |
| **40 - 60**  | **B1** | 3,000 - 6,000   | 四级 (CET-4)          | 进阶阅读，能读懂大意     |
| **60 - 80**  | **B2** | 6,000 - 10,000  | 六级/雅思 6.0/托福 80 | 高阶阅读，学术入门       |
| **80 - 100** | **C1** | 10,000 - 15,000 | 雅思 7.5+/托福 100+   | 专业学术，母语水平       |
| **100+**     | **C2** | 15,000+         | GRE/专业领域          | 极生僻，文学/科研词汇    |

### 3.2 用户设置场景 (User Scenarios)

用户可以在设置中选择一种熟悉的标准，系统自动转换为 MRS：

- **场景 A (习惯 CEFR)**: 用户选择 "B2"，系统设定目标难度 `Target MRS = 70`。
- **场景 B (备考托福)**: 用户选择 "TOEFL 100 分目标"，系统设定 `Target MRS = 85`。
- **场景 C (备考四级)**: 用户选择 "CET-4"，系统设定 `Target MRS = 50`。

### 3.3 单词高亮逻辑 (Highlight Logic)

基于 MRS 分数判断该词"是否值得背/是否可能不认识"：

- **Diff = Word_MRS - User_MRS**
- 如果 `Diff > 0` (词比人难)：默认高亮，提示生词。
- 如果 `Diff < -20` (词比人简单太多)：默认不高亮，视为"过于简单"。
- 如果 `Diff` 在 -20 到 0 之间：根据用户的"高亮密度偏好"决定（想多背点就高亮，想读顺点就不高亮）。

---

## 4. Implementation Plan (实施计划)

### Phase 2.1: Data Integration (数据整合)

1.  [ ] **下载完整 ECDICT**: 获取 77 万词库 CSV。
2.  [ ] **生成 Core JSON**: 编写脚本筛选 Top 20,000 高频词，保留 `frq`, `translation`, `tag` 字段。
3.  [ ] **计算 MRS**: 为每个词计算初始 MRS 分数 (基于 Rank 和 Tag)。
    - 公式示例: `MRS = log(Rank) * Factor` + `Tag_Bonus`

### Phase 2.2: Backend Upgrade (后端升级)

1.  [ ] **Schema Update**: 更新 `cefr_words.json` 结构，增加 `mrs_score` 字段。
2.  [ ] **Hybrid Query**: 修改 `get_word_definition` 服务：
    - Found in Core JSON? -> Return.
    - Found in Local Cache DB? -> Return.
    - Request External API -> Save to Cache DB -> Return.

### Phase 2.3: User Preference (用户偏好)

1.  [ ] **API Update**: `/user/settings` 支持设置 `exam_goal` (如 "toefl", "ietls")。
2.  [ ] **Difficulty Logic**: 将后端的高亮逻辑从 `if level == 'B1'` 升级为 `if word_mrs >= user_mrs`。

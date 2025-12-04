# 单词复习系统文档导航

## 文档概览

这个模块的文档分为三部分，面向不同的读者和用途。根据你的需求，选择合适的入口：

```
┌─────────────────────────────────────────────────────────────────┐
│                      vocabulary-review文档树                      │
├─────────────────────────────────────────────────────────────────┤
│ INDEX.md (本文件)                                                 │
│   └─ 文档导航和快速查找                                           │
│                                                                  │
│ README.md                                                        │
│   ├─ 现状分析                                                    │
│   ├─ MixRead特定的系统设计                                        │
│   ├─ API设计                                                     │
│   ├─ 前端实现                                                    │
│   ├─ 三个实施阶段的完整规划                                        │
│   └─ 整合点和迁移策略                                             │
│                                                                  │
│ ARCHITECTURE.md                                                  │
│   ├─ 通用SRS核心库架构（解耦背单词业务）                           │
│   ├─ 分层设计（核心库、会话、适配、API）                           │
│   ├─ 跨项目复用示意                                               │
│   ├─ 代码组织结构                                                │
│   └─ 测试策略                                                    │
│                                                                  │
│ QUICK_START.md                                                   │
│   ├─ 快速实现指南（4个步骤）                                      │
│   ├─ 核心库接口定义（可复用）                                     │
│   ├─ MixRead适配层实现                                           │
│   ├─ API端点完整代码                                             │
│   ├─ 前端集成示例                                                │
│   └─ 测试检查清单                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速查找

### 按角色查找

#### 👤 产品经理 / 项目经理

**想了解这个功能做什么？**
→ 阅读 [README.md - Overview](README.md#overview) 和 [Current State Analysis](README.md#current-state-analysis)

**想知道什么时候能交付？**
→ 查看 [README.md - Implementation Plan](README.md#implementation-plan)
- 第一阶段：基础闪卡（1-2周）
- 第二阶段：间隔重复（2-3周）
- 第三阶段：高级功能（持续）

**想看关键指标？**
→ [README.md - Success Metrics](README.md#success-metrics)

---

#### 👨‍💻 后端工程师 - MixRead项目

**快速启动实现？**
→ 从 [QUICK_START.md](QUICK_START.md) 开始

**第一步做什么？**
→ [QUICK_START.md - 第一步：实现核心库接口](QUICK_START.md#第一步实现核心库接口2小时)

**需要理解完整设计？**
→ [README.md - System Architecture](README.md#system-architecture)

**需要API详细说明？**
→ [README.md - API Design](README.md#api-design)

**遇到数据库问题？**
→ [README.md - Data Migration Strategy](README.md#data-migration-strategy)

---

#### 🔧 架构师 / 技术负责人

**想设计可复用系统？**
→ 重点阅读 [ARCHITECTURE.md - 核心思想](ARCHITECTURE.md#核心思想)

**需要分层架构？**
→ [ARCHITECTURE.md - 分层架构](ARCHITECTURE.md#分层架构)
- 第1层：SRS引擎（独立库）
- 第2层：会话管理（独立库）
- 第3层：适配层（应用特定）
- 第4层：API（应用特定）

**想看跨项目复用示意？**
→ [ARCHITECTURE.md - 跨项目复用示意](ARCHITECTURE.md#跨项目复用示意)

**怎样管理代码和版本？**
→ [ARCHITECTURE.md - 代码组织结构](ARCHITECTURE.md#代码组织结构) 和 [核心库的发布和版本管理](ARCHITECTURE.md#核心库的发布和版本管理)

**测试该怎么做？**
→ [ARCHITECTURE.md - 测试策略](ARCHITECTURE.md#测试策略)

---

#### 🎓 新开发者 / 学习者

**想了解完整流程？**
1. 先读 [README.md - Overview](README.md#overview)
2. 再看 [QUICK_START.md - 第一步](QUICK_START.md#第一步实现核心库接口2小时)
3. 理解 [ARCHITECTURE.md - 分层架构](ARCHITECTURE.md#分层架构)

**想跑通一个完整示例？**
→ [QUICK_START.md](QUICK_START.md) 包含所有代码片段，可复制粘贴

**SRS算法是什么？**
→ [QUICK_START.md - SpacedRepetitionEngine](QUICK_START.md#12-实现srs调度器)

---

### 按任务查找

| 任务 | 文档位置 |
|------|---------|
| 理解业务需求 | [README.md#overview](README.md#overview) |
| 分析现有代码 | [README.md#current-state-analysis](README.md#current-state-analysis) |
| 设计系统架构 | [ARCHITECTURE.md#分层架构](ARCHITECTURE.md#分层架构) |
| 快速开发MVP | [QUICK_START.md](QUICK_START.md) |
| 实现核心库 | [QUICK_START.md#第一步实现核心库接口2小时](QUICK_START.md#第一步实现核心库接口2小时) |
| 实现适配层 | [QUICK_START.md#第二步实现mixread适配层1小时](QUICK_START.md#第二步实现mixread适配层1小时) |
| 写API端点 | [QUICK_START.md#第三步api端点1小时](QUICK_START.md#第三步api端点1小时) |
| 前端集成 | [QUICK_START.md#第四步前端集成2小时](QUICK_START.md#第四步前端集成2小时) |
| 设计可复用库 | [ARCHITECTURE.md#可复用的记忆系统核心库架构](ARCHITECTURE.md#可复用的记忆系统核心库架构) |
| 跨项目复用 | [ARCHITECTURE.md#跨项目复用示意](ARCHITECTURE.md#跨项目复用示意) |
| 设计测试 | [ARCHITECTURE.md#测试策略](ARCHITECTURE.md#测试策略) |
| 配置版本管理 | [ARCHITECTURE.md#核心库的发布和版本管理](ARCHITECTURE.md#核心库的发布和版本管理) |
| 看完整示例代码 | [QUICK_START.md#快速启动实现第一个复习会话](QUICK_START.md#快速启动实现第一个复习会话) |
| 了解实施计划 | [README.md#implementation-plan](README.md#implementation-plan) |
| 评估工作量 | [README.md#implementation-plan](README.md#implementation-plan) |

---

## 文档对比

### README.md vs ARCHITECTURE.md vs QUICK_START.md

```
维度           README.md           ARCHITECTURE.md          QUICK_START.md
────────────────────────────────────────────────────────────────────────
关注点         MixRead功能设计     系统可复用性              快速实现MVP
受众           产品/项目/开发者     架构师/技术主管           开发者
代码详度       中等                低（设计为主）            高（完整示例）
阶段规划       详细（P1/P2/P3）    无阶段划分               预计投入8-10小时
数据库关系     涉及MixRead特定     通用接口设计             具体实现细节
集成点         详细说明            通过接口解耦             代码示例
迁移策略       已提供              N/A                     测试清单
成功指标       已定义              N/A                     检查清单
────────────────────────────────────────────────────────────────────────
何时读         了解需求时          设计系统架构时            开始编码时
何时用         PM审批，开发参考    技术决策，新项目参考      每日工作参考
────────────────────────────────────────────────────────────────────────
```

### 文档之间的关系

```
README.md（是什么）
    ↓ 设计细节
ARCHITECTURE.md（怎么设计得可复用）
    ↓ 代码实现
QUICK_START.md（怎么快速实现）
```

**典型阅读流程：**
```
PM/Product → README.md（理解需求）
             ↓
CTO/Architect → ARCHITECTURE.md（设计架构）
                 ↓
Developer → QUICK_START.md（编写代码）
            ↓ 遇到问题
            参考 README.md 或 ARCHITECTURE.md
```

---

## 核心设计决策

### 为什么要分三份文档？

| 文档 | 原因 |
|------|------|
| **README.md** | 面向MixRead特定需求，记录完整的产品功能设计 |
| **ARCHITECTURE.md** | 面向长期维护和复用，解耦业务逻辑从实现 |
| **QUICK_START.md** | 面向快速落地，提供即插即用的代码模板 |

### 核心架构原则

1. **解耦**：SRS核心库与MixRead业务完全独立
   - 核心库：纯算法 + 会话管理
   - 适配层：业务逻辑 + 数据库
   - 参考：[ARCHITECTURE.md - 分层架构](ARCHITECTURE.md#分层架构)

2. **复用**：三个层次的复用
   - L1：纯SRS算法（任何项目可用）
   - L2：会话框架（任何闪卡应用可用）
   - L3：适配示例（新项目参考实现）
   - 参考：[ARCHITECTURE.md - 跨项目复用示意](ARCHITECTURE.md#跨项目复用示意)

3. **可测试**：核心库无副作用
   - 所有函数纯化
   - 通过回调获取数据
   - 返回结果对象由应用保存
   - 参考：[QUICK_START.md - SpacedRepetitionEngine](QUICK_START.md#12-实现srs调度器)

---

## 常见问题

### Q1: 我只想快速实现MixRead的复习功能，应该读什么？
**A:** [QUICK_START.md](QUICK_START.md) - 它包含所有必要代码，预计8-10小时完成MVP

### Q2: 我需要为另一个项目复用这个SRS系统，怎么做？
**A:**
1. 了解架构：[ARCHITECTURE.md](ARCHITECTURE.md)
2. 复用核心库：[QUICK_START.md#第一步](QUICK_START.md#第一步实现核心库接口2小时)
3. 实现适配层：[QUICK_START.md#第二步](QUICK_START.md#第二步实现mixread适配层1小时)的模式

### Q3: SRS算法和SM-2有什么区别？
**A:** 这个实现是简化的SM-2，详见：[README.md#spaced-repetition-algorithm](README.md#spaced-repetition-algorithm)

### Q4: 怎样保证代码质量？
**A:** 查看测试策略：[ARCHITECTURE.md#测试策略](ARCHITECTURE.md#测试策略)

### Q5: 实现分三个阶段，我们现在应该做到哪一步？
**A:** 通常从[第一阶段](README.md#phase-1-basic-flashcards-1-2-weeks)开始（1-2周完成MVP）

---

## 下一步行动

### 立即行动（选择一个）

- **是PM/决策者？**
  - [ ] 阅读 [README.md - Overview](README.md#overview)
  - [ ] 查看 [Implementation Plan](README.md#implementation-plan)
  - [ ] 与团队讨论时间表

- **是架构师/技术主管？**
  - [ ] 阅读 [ARCHITECTURE.md](ARCHITECTURE.md)
  - [ ] 审视代码组织结构
  - [ ] 决定核心库的发布方式

- **是开发者？**
  - [ ] 克隆代码模板从 [QUICK_START.md](QUICK_START.md)
  - [ ] 本地运行第一个测试
  - [ ] 提交PR进行代码审查

---

## 版本历史

| 版本 | 日期 | 更新 |
|------|------|------|
| 1.0 | 2025-12-04 | 初始文档：README + ARCHITECTURE + QUICK_START |

---

## 文件大小参考

| 文件 | 大小 | 阅读时间 |
|------|------|---------|
| INDEX.md（本文件） | ~3KB | 10分钟 |
| README.md | ~28KB | 30-45分钟 |
| ARCHITECTURE.md | ~15KB | 20-30分钟 |
| QUICK_START.md | ~22KB | 30-45分钟（含代码示例） |
| **总计** | ~68KB | **90-150分钟** |

根据你的角色，可能只需阅读其中1-2份文档。

---

## 反馈和改进

如果有任何问题或建议，请：
1. 查阅对应的文档部分
2. 检查本INDEX的"常见问题"
3. 提交issue或讨论

---

**最后更新：2025-12-04**
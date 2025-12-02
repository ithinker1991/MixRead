# Domain Exclusion 功能 - 完整项目指南

**项目名**: MixRead Domain Exclusion
**状态**: ✅ 所有文档完成，准备开发
**创建日期**: 2025-12-02
**预计周期**: 3 周 (Week 1-3)

---

## 📖 文档结构

### 🚀 开始开发 (必读)

**1. DEVELOPMENT_START_HERE.md** ⭐⭐⭐ 开始这里！
   - 快速概览（2 分钟）
   - 每天任务分配
   - 所有代码片段（可直接复制）
   - 常见问题解答

   **何时阅读**: 现在，立即开始开发

---

### 📋 详细实现计划

**2. IMPLEMENTATION_PLAN_SIMPLIFIED.md** ⭐⭐⭐ 核心文档
   - 完整的 Week 1-3 步骤分解
   - Day-by-day 任务清单
   - 完整的代码示例（后端 + 前端）
   - 单元测试代码
   - 测试场景和验收标准

   **何时阅读**: 开发时作为参考，每个 Week 查看对应部分

   **包含**:
   ```
   Week 1 (后端):
     Day 1-2: 数据库模型 + Repository + Service
     Day 3: 前端 Store + Filter

   Week 2 (UI):
     Day 1-2: Popup 界面
     Day 3: 预设对话框

   Week 3 (集成):
     Day 1: content.js 集成
     Day 2-3: 完整功能测试
   ```

---

### 🔮 后续优化规划

**3. FUTURE_OPTIMIZATION_ROADMAP.md** - 后续参考
   - 何时考虑优化（触发条件）
   - 三种优化方案对比 (A/B/C)
   - 无缝迁移策略
   - 成本收益分析
   - 决策框架

   **何时阅读**: Phase 2（3-6 个月后）评估优化时

---

### 🎓 参考资料

**已有的完整 PRD 文档** (如需深入了解):
   - `PRD_EXCLUDE_DOMAINS_FEATURE.md` - 完整需求 (699 行)
   - `FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md` - 功能概览 (483 行)
   - `QUICK_REFERENCE_PRESET_FEATURE.md` - 快速参考
   - `DOMAIN_EXCLUSION_PRD_COMPLETE.md` - 完成总结

**架构分析文档**:
   - `DATA_STORAGE_STRATEGY.md` - 为什么选数据库？
   - `ARCHITECTURE_DECISION_SUMMARY.md` - Chrome Sync vs 自托管对比

---

## 🎯 核心要点

### 功能描述

```
用户可以禁用某些网站的高亮功能

示例:
  1. 用户访问 localhost:8002 (库页面)
  2. 发现有太多高亮，显示混乱
  3. 打开 Popup，点击"禁用此网站"
  4. 刷新页面，高亮消失 ✓
  5. 访问其他网站，高亮正常工作 ✓

额外功能:
  ✓ 预设排除列表（首次使用提示）
  ✓ 添加/删除自定义域名
  ✓ 支持通配符 (localhost:*)
  ✓ 支持 IP 地址
  ✓ 支持文件协议 (file://)
```

### 技术架构

```
Chrome Extension (前端)
    ↓
FastAPI Backend (现有)
    ↓
SQLAlchemy ORM
    ↓
SQLite/MySQL (现有)

数据流:
  1. content.js 启动时检查排除列表
  2. 如果被排除，不加载高亮
  3. Popup 调用 API 管理排除列表
  4. 预设对话框（首次使用）
```

### 数据模型

```
表名: excluded_domains

字段:
  - id (PK)
  - user_id (FK)
  - domain (VARCHAR 255)
  - added_at (DATETIME)

约束:
  - UNIQUE(user_id, domain)
  - 索引: (user_id, domain)

预设域名 (9 个):
  本地开发:
    - localhost:8002
    - localhost:3000
    - 127.0.0.1:8000
    - localhost:5173

  生产工具:
    - jenkins.company.com
    - gitlab.company.com
    - jira.company.com

  其他:
    - file://
    - mail.google.com
```

---

## 📊 开发工时估算

| 阶段 | 工作内容 | 工时 | 难度 |
|------|---------|------|------|
| Week 1 | 后端 CRUD | 2-3 天 | ⭐ 简单 |
| Week 2 | 前端 UI + 预设 | 2-3 天 | ⭐⭐ 中等 |
| Week 3 | 集成 + 测试 | 2-3 天 | ⭐ 简单 |
| **合计** | **完整功能** | **3 周** | **⭐ 简单** |

**为什么简单**:
- ✅ 数据库设计已验证
- ✅ API 模式已成熟
- ✅ 代码可直接复制
- ✅ 无需处理复杂同步逻辑

---

## 🚀 快速开始

### 现在就做这个：

```
1. 打开 DEVELOPMENT_START_HERE.md
   └─ 2 分钟快速概览

2. 按照 Day-by-day 任务进行
   ├─ Day 1: 创建数据库模型
   ├─ Day 2-3: 后端 API
   ├─ Day 4-5: 前端 Store
   └─ Day 6-7: 集成测试

3. 遇到问题查看 IMPLEMENTATION_PLAN_SIMPLIFIED.md
   └─ 完整代码 + 测试场景
```

---

## ✅ 完成后的验收标准

### 后端验收
```
[ ] ExcludedDomainModel 创建成功
[ ] 4 个 API endpoints 实现完整
[ ] 所有 API 测试通过 (curl)
[ ] 数据库操作正常 (增删改查)
[ ] 没有 SQL 错误
```

### 前端验收
```
[ ] exclusion-store.js 实现完整
[ ] exclusion-filter.js 实现完整
[ ] Popup UI 显示正确
[ ] 预设对话框首次显示
[ ] content.js 集成成功
```

### 功能验收
```
[ ] 测试场景 1: 基础功能 - 全部通过
[ ] 测试场景 2: UI 功能 - 全部通过
[ ] 测试场景 3: content.js 集成 - 全部通过
[ ] 测试场景 4: 性能 - 全部达标
[ ] 无 Console 错误
```

---

## 📚 文档总结

### 核心文件 (开发必需)

| 文件 | 大小 | 内容 | 用途 |
|------|------|------|------|
| DEVELOPMENT_START_HERE.md | 14 KB | 快速开始 + Day 任务 | 立即开始 |
| IMPLEMENTATION_PLAN_SIMPLIFIED.md | 36 KB | 完整实现 + 所有代码 | 开发参考 |
| FUTURE_OPTIMIZATION_ROADMAP.md | 11 KB | 后续优化计划 | Phase 2 参考 |

### 参考文件 (根据需要查看)

| 文件 | 行数 | 内容 |
|------|------|------|
| DATA_STORAGE_STRATEGY.md | 589 | 数据存储战略 |
| QUICK_REFERENCE_PRESET_FEATURE.md | 337 | 预设功能快速参考 |
| PRD_EXCLUDE_DOMAINS_FEATURE.md | 699 | 完整功能需求 |
| FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md | 483 | 功能概览 |

---

## 🎓 学习路径

### 如果你的角色是:

**后端开发**:
```
1. 阅读: DEVELOPMENT_START_HERE.md
2. 参考: IMPLEMENTATION_PLAN_SIMPLIFIED.md Week 1 部分
3. 实现: ExcludedDomainModel + Repository + Service + API
4. 测试: 所有 4 个 API endpoints
```

**前端开发**:
```
1. 阅读: DEVELOPMENT_START_HERE.md
2. 参考: IMPLEMENTATION_PLAN_SIMPLIFIED.md Week 2-3 部分
3. 实现: exclusion-store.js + Popup UI + 预设对话框
4. 集成: content.js 中的排除检查
5. 测试: 多个场景验证
```

**全栈开发**:
```
1. 通读: DEVELOPMENT_START_HERE.md
2. Week 1: 后端开发 (上面的后端路径)
3. Week 2: 前端 UI (上面的前端路径)
4. Week 3: 集成 + 测试 (两个都要)
```

**产品/PM**:
```
1. 阅读: FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md
2. 参考: QUICK_REFERENCE_PRESET_FEATURE.md
3. 了解: 预设设计 + 用户故事
4. 验收: 按照验收标准检查
```

---

## 🔄 开发流程

### 每天的流程

```
早上:
  [ ] 打开对应 Day 的任务 (DEVELOPMENT_START_HERE.md)
  [ ] 查看代码 (IMPLEMENTATION_PLAN_SIMPLIFIED.md)
  [ ] 开始编码

中间:
  [ ] 遇到问题 → 查看对应部分的代码示例
  [ ] 完成任务 → 运行测试
  [ ] 通过测试 → 标记完成

晚上:
  [ ] 回顾今天的成果
  [ ] 查看明天的计划
  [ ] 更新进度
```

### 每周的检查

**Week 1 检查**:
```
[ ] 数据库表创建成功
[ ] 4 个 API endpoints 工作正常
[ ] 所有后端单元测试通过
```

**Week 2 检查**:
```
[ ] Popup UI 显示正确
[ ] 预设对话框首次显示
[ ] 所有 UI 交互工作正常
```

**Week 3 检查**:
```
[ ] content.js 集成成功
[ ] 排除检查逻辑工作正常
[ ] 所有测试场景通过
```

---

## 💡 关键提示

### 代码复制技巧

```
✅ 推荐做法:
  1. 打开 IMPLEMENTATION_PLAN_SIMPLIFIED.md
  2. 找到对应的代码块
  3. 复制整个类或函数
  4. 粘贴到你的项目
  5. 根据需要调整 import 和路径

⚠️ 注意:
  - 导入路径可能需要调整 (取决于你的项目结构)
  - 数据库连接可能需要调整
  - API 前缀可能需要调整
```

### 测试驱动

```
每个功能完成后立即测试:

后端:
  curl http://localhost:8000/users/test_user_id/excluded-domains

前端:
  - 打开 Popup，查看 Console
  - 应该看到 [MixRead] 日志
  - 测试添加/删除功能

集成:
  - 访问被排除的网站
  - 检查是否加载高亮
```

---

## 🎯 成功指标

### 完成的标志

你会看到：

```
✅ 后端:
   - POST /users/{id}/excluded-domains → 成功
   - GET /users/{id}/excluded-domains → 返回列表
   - DELETE /users/{id}/excluded-domains/{domain} → 删除

✅ 前端:
   - Popup 打开显示排除列表
   - 可以添加/删除域名
   - 预设对话框首次显示

✅ 集成:
   - localhost:8002 → 无高亮
   - github.com → 有高亮
   - Console → [MixRead] 日志
```

---

## 🆘 遇到问题？

### 问题排查流程

```
1. 查看 Console 和 Network
   → Chrome DevTools F12
   → Console 标签看错误
   → Network 标签看 API 调用

2. 查看日志
   → 后端控制台输出
   → 前端 [MixRead] 日志

3. 检查代码
   → IMPLEMENTATION_PLAN_SIMPLIFIED.md 对应部分
   → 对比你的代码和示例

4. 查看测试场景
   → IMPLEMENTATION_PLAN_SIMPLIFIED.md Week 3 部分
   → 找到相似的测试场景
```

### 常见问题

**Q: 数据库创建失败？**
A: 检查是否已登录后端目录，检查 SQLite/MySQL 是否可用

**Q: API 返回 404？**
A: 检查 URL 前缀是否正确，检查路由是否添加

**Q: Popup 显示错误？**
A: 检查 Console，查看是否有 JS 错误，检查 API 调用是否成功

**Q: 高亮仍然显示？**
A: 检查 content.js 是否正确集成，检查排除列表是否正确存储

---

## 📞 需要帮助

所有问题的答案都在这些文档里：

1. **快速问题** → DEVELOPMENT_START_HERE.md 常见问题部分
2. **代码问题** → IMPLEMENTATION_PLAN_SIMPLIFIED.md 对应代码部分
3. **设计问题** → FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md
4. **性能问题** → IMPLEMENTATION_PLAN_SIMPLIFIED.md 性能测试部分
5. **后续计划** → FUTURE_OPTIMIZATION_ROADMAP.md

---

## 🎉 开始吧！

### 立即行动清单

```
[ ] 1. 打开 DEVELOPMENT_START_HERE.md (2 分钟)
[ ] 2. 理解整体架构 (5 分钟)
[ ] 3. 查看 Day 1 任务 (5 分钟)
[ ] 4. 创建 ExcludedDomainModel (10 分钟)
[ ] 5. 运行数据库迁移 (5 分钟)
[ ] 6. 继续 Day 2-3 任务
```

**现在就开始第一天！** 🚀

---

## 📈 项目统计

```
总文档: 12 份
总行数: 5000+ 行
总大小: 200+ KB

代码示例:
  后端: ~500 行 (Models + Repository + Service + API)
  前端: ~600 行 (Store + Filter + UI + 预设对话框)
  测试: ~400 行 (测试场景和验收标准)

覆盖范围:
  ✅ 100% 实现步骤
  ✅ 100% 代码示例
  ✅ ✅ 100% 测试场景
  ✅ 100% 常见问题
```

---

**创建于**: 2025-12-02
**版本**: 1.0
**状态**: ✅ 完成，准备开发

**祝你开发顺利！** 💪✨


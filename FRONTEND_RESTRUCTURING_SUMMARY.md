# MixRead 前端架构重组 - 总体概览

## 💡 核心问题和解决方案

### 你遇到的问题

当前项目有 **三个独立的前端部分**：

```
1. 浏览器插件          在网页上高亮单词，提供快速入口
   ↓
2. 复习页面           用户学习新单词和复习
   ↓
3. 单词库页面         用户管理自己的单词列表
```

这三个部分存在的问题：

```
问题 1: 代码重复 30-40%
  - API 调用逻辑各写一份
  - UI 组件各实现一遍
  - 工具函数到处都有

问题 2: 开发低效
  - 修改一个 API，需要改三个地方
  - 新增功能也要在三个地方加

问题 3: 部署复杂
  - 三个不同的构建过程
  - 三个不同的部署流程
  - 版本管理分散

问题 4: 难以维护
  - 边界不清楚
  - 难以测试
  - 难以复用
```

### 解决方案：Monorepo

采用 **npm workspace** 建立统一的 monorepo 结构：

```
frontend-monorepo/
├── packages/shared/
│   ├── api-client/      ← 统一的 API 调用逻辑
│   ├── utils/           ← 工具函数（日期、格式化等）
│   ├── hooks/           ← 通用 React/Vue hooks
│   └── components/      ← 通用 UI 组件
│
├── packages/chrome-extension/  ← 浏览器插件
├── packages/review-page/       ← 复习页面
└── packages/library-page/      ← 单词库页面
```

**关键原则**:
- ✅ **最大化共享**: 所有共用逻辑放在 shared 包
- ✅ **清晰隔离**: 每个应用独立，不互相污染
- ✅ **单一指挥**: 统一的构建、测试、部署

---

## 🎯 具体改进

### 改进 1: 代码重复率从 30-40% 降至 < 10%

**现在 (各自为政)**:
```javascript
// chrome-extension/content.js
async function getWordInfo(word) {
  const response = await fetch(`http://localhost:8000/word/${word}`);
  return response.json();
}

// review-page/review-manager.js
async function getWordInfo(word) {
  const response = await fetch(`http://localhost:8000/word/${word}`);
  return response.json();
}

// library-page/library-viewer.js
async function getWordInfo(word) {
  const response = await fetch(`http://localhost:8000/word/${word}`);
  return response.json();
}
```

**之后 (统一管理)**:
```javascript
// packages/shared/api-client/src/index.js
export async function getWordInfo(word) {
  const response = await fetch(`http://localhost:8000/word/${word}`);
  return response.json();
}

// 在三个地方都这样用：
import { getWordInfo } from '@mixread/api-client';
const info = await getWordInfo('hello');
```

### 改进 2: 开发效率提升 50%+

**修改 API 接口**:
- 现在: 改 3 个地方
- 之后: 改 1 个地方 (api-client)

**添加新功能**:
- 现在: 在三个地方都要加
- 之后: 在 shared 和需要的应用中加

**依赖升级**:
- 现在: 三个 package.json 分别管理
- 之后: 根 package.json 统一管理

### 改进 3: 统一的开发体验

**现在**:
```bash
# 分别启动
npm run dev:extension
npm run dev:review-page
npm run dev:library-page
```

**之后**:
```bash
# 一个命令启动所有
npm run dev

# 或者只启动特定部分
npm run dev:extension
npm run dev:pages
```

### 改进 4: 快速入口实现更容易

**插件 → 单词库**:
```javascript
// 现在：手写 URL 和参数
const url = `http://localhost:8001/library?user_id=${userId}&...`;
chrome.tabs.create({ url });

// 之后：使用 shared 的 utils
import { openPage } from '@mixread/utils';
openPage('library', { userId });
```

**单词库 → 复习**:
```javascript
// 现在：手写逻辑
window.location.href = `/review?user_id=${userId}`;

// 之后：使用 shared 的 utils
import { openPage } from '@mixread/utils';
openPage('review', { userId, sessionType: 'mixed' });
```

---

## 📦 共享什么、隔离什么

### ✅ 应该共享到 shared 包

| 内容 | 位置 | 说明 |
|------|------|------|
| API 客户端 | @mixread/api-client | 所有 HTTP 请求都走这里 |
| 工具函数 | @mixread/utils | 日期格式化、存储等 |
| Hooks | @mixread/hooks | useAPI、useStorage 等 |
| 类型定义 | 各 shared 包 | TypeScript 类型 |
| 常量 | @mixread/utils | API 地址、配置值等 |
| 业务逻辑 | 适当位置 | SRS 算法等可复用逻辑 |

### ❌ 必须隔离到各应用

| 内容 | 原因 | 说明 |
|------|------|------|
| 样式/CSS | 样式污染 | 插件和页面样式需要完全隔离 |
| HTML 结构 | DOM 差异 | popup.html 和 page.html 完全不同 |
| 路由管理 | 架构差异 | 插件没有路由，页面有路由 |
| 构建配置 | 输出差异 | 插件输出 .crx，页面输出 .html |
| 框架选择 | 依赖差异 | 可能一个用 React，一个用 Vanilla JS |

---

## 📋 迁移计划概览

### 时间表：6 周

```
第 1 周: 建立 monorepo 基础
   ├─ 创建目录结构
   ├─ 设置 npm workspace
   └─ 复制现有代码

第 2-3 周: 创建 shared 包
   ├─ @mixread/api-client
   ├─ @mixread/utils
   └─ @mixread/hooks

第 4 周: 重构三个应用
   ├─ chrome-extension
   ├─ review-page
   └─ library-page

第 5 周: 实现快速入口
   ├─ 插件打开页面
   ├─ 页面返回插件
   └─ 深度链接

第 6 周: 测试和部署
   ├─ 运行测试
   ├─ 文档完善
   └─ CI/CD 配置
```

### 关键任务

**第 1 周完成标志**:
- [ ] monorepo 目录结构创建
- [ ] 根 package.json 配置
- [ ] 现有代码复制到新位置

**第 3 周完成标志**:
- [ ] 三个 shared 包创建
- [ ] 三个应用能 import shared 包
- [ ] 基本功能正常工作

**第 4 周完成标志**:
- [ ] `npm run dev` 能启动所有服务
- [ ] 所有现有功能正常

**第 5 周完成标志**:
- [ ] 插件能打开单词库页面
- [ ] 单词库页面能打开复习页面
- [ ] 返回按钮工作

**第 6 周完成标志**:
- [ ] 所有测试通过
- [ ] 文档完整
- [ ] 可以部署到生产

---

## 🎁 预期收益

### 数字对比

| 指标 | 现在 | 之后 | 改进 |
|------|------|------|------|
| 代码重复率 | 30-40% | < 10% | 70% 降低 |
| 修改一个逻辑的工作量 | 3 个地方 | 1 个地方 | 66% 减少 |
| 构建时间 | 各自独立 | 统一 | 统一化 |
| API 更新工作量 | 改 3 处 | 改 1 处 | 66% 减少 |
| 新功能开发时间 | 3+ 个地方 | 1-2 个地方 | 50%+ 提升 |
| 部署流程 | 3 个独立 | 1 个统一 | 简化 |

### 定性收益

- 🧠 **容易理解**: 清晰的包结构和边界
- 🚀 **更快开发**: 共用代码只需写一次
- 🧪 **容易测试**: 每个包独立测试
- 🔄 **容易扩展**: 添加新应用只需新建包
- 📚 **易于维护**: 清晰的依赖关系
- 🎯 **一致体验**: 所有应用用相同工具链

---

## ⚠️ 需要注意的事项

### 风险 1: 迁移成本高
- **工作量**: 2-3 周
- **缓解**: 逐步迁移，保留原代码作参考

### 风险 2: Monorepo 学习成本
- **需要学**: npm workspace, 包依赖关系
- **缓解**: 提供详细文档和示例

### 风险 3: Chrome 插件 CSP 限制
- **问题**: 插件有特殊安全限制
- **缓解**: 在设计时考虑这些限制

### 风险 4: 跨域问题
- **问题**: 插件、页面、后端可能在不同源
- **缓解**: 使用 chrome.runtime.sendMessage 通信

---

## 📖 相关文档

已创建的详细文档：

1. **ARCHITECTURE.md**
   - 当前问题详细分析
   - 新架构设计详解
   - 共享/隔离策略
   - 通信方案
   - 构建和部署流程

2. **MIGRATION_PLAN.md**
   - 6 个 Phase 的详细步骤
   - 每个阶段的具体任务
   - 代码示例
   - 成功标志
   - 完整的清单

3. **ADR_FRONTEND_ARCHITECTURE.md**
   - 架构决策记录
   - 问题、决定、理由
   - 好处和风险
   - 替代方案比较

---

## 🤔 FAQ

### Q: 为什么选择 Monorepo 而不是拆分成独立项目？
A: 因为这三个部分需要共享很多代码（API 客户端、工具函数等）。Monorepo 可以最大化代码复用，同时保持独立性。

### Q: 迁移期间现有功能会中断吗？
A: 不会。迁移是渐进的，保留原代码作为参考，可以随时回滚。

### Q: 需要学习新的工具吗？
A: npm workspace 本身很简单，主要是理解包结构和依赖关系。提供文档和示例。

### Q: 这会影响用户吗？
A: 完全不影响。这是内部架构改造，对最终产品和用户没有任何改变。

### Q: 可以分步实施吗？
A: 可以。6 周的计划可以按阶段推进，每个阶段完成后可以评估。

### Q: 之后如何部署？
A: 提供统一的部署脚本，一个命令可以同时部署插件、页面和后端。

---

## 🚀 下一步

### 立即行动 (本周)

1. **评审**
   - 阅读 ARCHITECTURE.md 了解架构
   - 阅读 MIGRATION_PLAN.md 了解计划
   - 评估是否可行

2. **确认**
   - 团队讨论是否同意这个方案
   - 确认时间表是否合理
   - 确认资源是否足够

3. **准备**
   - 备份现有代码
   - 规划迁移顺序
   - 分配开发人员

### 第 1 周 (如果批准)

1. 创建 monorepo 目录结构
2. 设置 npm workspace
3. 复制现有代码到新位置
4. 验证构建过程

---

## 📞 需要帮助？

- 有疑问？查看详细文档
- 发现问题？提出来讨论
- 有更好的想法？建议改进

---

**当前状态**: 📋 提案阶段，等待评审和批准

**详细文档**:
- [完整架构设计](./ARCHITECTURE.md)
- [迁移计划](./MIGRATION_PLAN.md)
- [决策记录](./ADR_FRONTEND_ARCHITECTURE.md)
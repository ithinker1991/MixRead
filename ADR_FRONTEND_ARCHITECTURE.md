# ADR-001: 前端架构 - Monorepo 设计

**状态**: 提议中

**决定者**: 团队
**受影响者**: 所有前端开发者
**提出日期**: 2024-12-05

---

## 背景

MixRead 项目现有三个前端部分：
1. **浏览器插件** (Chrome Extension) - 页面上的单词高亮和快速入口
2. **复习页面** (Review Session) - 用户的单词复习界面
3. **单词库页面** (Vocabulary Library) - 用户的单词管理界面

这三个部分当前分散在 `/frontend` 目录中，存在以下问题：

### 问题 1: 代码重复
- API 调用逻辑在三个地方重复
- UI 组件（按钮、卡片等）各自实现
- 工具函数（日期格式化、存储等）重复定义
- 估计重复率：30-40%

### 问题 2: 开发效率低
- 修改一个 API 接口，需要在三个地方同时更新
- 新增功能需要在三个地方添加
- 依赖管理分散，难以追踪

### 问题 3: 部署复杂
- 插件需要特殊构建 (Chrome Web Store)
- 页面需要部署到 Web 服务器
- 后端 API 需要部署到服务器
- 没有统一的版本管理

### 问题 4: 缺乏模块化
- 没有清晰的界限
- 难以测试
- 难以复用

---

## 决定

采用 **Monorepo** 架构（使用 npm workspace）来统一管理三个前端部分。

### 核心原则

1. **最大化代码共享** - 共用逻辑提取到 shared 包
2. **清晰隔离** - 每个应用独立，不互相污染
3. **渐进迁移** - 不中断现有开发，逐步迁移
4. **单一指挥** - 统一的构建、测试、部署流程

---

## 新架构

```
frontend-monorepo/
├── packages/
│   ├── shared/                    # 共用模块
│   │   ├── api-client/
│   │   ├── utils/
│   │   ├── hooks/
│   │   └── components/
│   │
│   ├── chrome-extension/          # 浏览器插件
│   ├── review-page/               # 复习页面
│   └── library-page/              # 单词库页面
│
├── scripts/                       # 构建脚本
├── docs/                          # 文档
└── package.json                   # Workspace 配置
```

### 共享层 (Shared)

**哪些应该共享**:
- ✅ API 客户端 (调用后端接口)
- ✅ 工具函数 (日期、格式化、存储)
- ✅ TypeScript 类型定义
- ✅ 常量定义
- ✅ 通用 Hooks (useAPI、useStorage 等)

**哪些不应共享**:
- ❌ 样式/CSS (插件和页面样式需要隔离)
- ❌ HTML 结构 (popup 和 page 的 DOM 完全不同)
- ❌ 路由 (插件没有路由)
- ❌ 构建配置 (webpack 配置不同)

### 应用层

| 应用 | 职责 | 输出 |
|------|------|------|
| chrome-extension | 页面高亮、快速入口 | extension.crx |
| review-page | 单词复习 | review/index.html |
| library-page | 单词管理 | library/index.html |

---

## 好处

### 1. 开发效率提升 50%+
- **修改 API 接口**：从 3 个地方 → 1 个地方 (api-client)
- **添加新功能**：从 3+ 个地方 → 1-2 个地方
- **依赖升级**：统一管理，一次更新全部

### 2. 代码重复率从 30-40% → < 10%
```
现在：
- content.js
- review-manager.js
- library-manager.js
- 都有自己的 API 调用逻辑

之后：
- @mixread/api-client 统一提供
- 其他代码只需要 import 即可
```

### 3. 统一的开发体验
```bash
# 开发所有部分
npm run dev

# 开发单个部分
npm run dev:extension
npm run dev:pages

# 构建
npm run build

# 部署
npm run deploy
```

### 4. 易于扩展
- 添加新的前端应用：创建新的 packages/xxx
- 添加新的共用模块：在 packages/shared 中添加
- 共用代码自动被所有应用使用

### 5. 标准化工具链
- 统一的 webpack/rollup 配置
- 统一的 babel 配置
- 统一的 eslint/prettier 配置
- 统一的测试框架

---

## 劣势和风险

### 1. 初期迁移成本高
- **工作量**: 大约 2-3 周
- **风险**: 迁移过程中可能引入 bug
- **缓解**: 保留原代码作为参考，逐步迁移

### 2. Monorepo 复杂度
- 需要学习 npm workspace
- 需要理解各包之间的依赖关系
- **缓解**: 提供详细的文档和开发指南

### 3. 构建时间增加
- 需要构建所有包
- **缓解**: 使用增量构建，只构建改变的部分

### 4. Chrome 插件的特殊性
- 插件有 CSP (Content Security Policy) 限制
- 不能使用 eval 或动态 require
- 需要特殊处理样式隔离
- **缓解**: 在设计时考虑这些限制

---

## 实施计划

### 时间表
- **第 1 周**: 建立 monorepo 基础结构
- **第 2-3 周**: 创建 shared 包并迁移共用代码
- **第 4 周**: 重构三个应用
- **第 5 周**: 实现快速入口和深度链接
- **第 6 周**: 测试、文档和部署

### 关键里程碑
1. ✅ Monorepo 结构创建
2. ✅ shared 包完成
3. ✅ 三个应用正常工作
4. ✅ `npm run dev` 能启动所有服务
5. ✅ 所有现有功能正常
6. ✅ 文档完整

### 验收标准
- [ ] `npm install` 成功
- [ ] `npm run dev` 正常启动所有服务
- [ ] 插件能显示单词高亮
- [ ] 复习页面能正常工作
- [ ] 单词库页面能正常工作
- [ ] 代码重复率 < 10%
- [ ] 所有测试通过
- [ ] 文档完整清晰

---

## 替代方案考虑

### 方案 A: 不变 ❌
**优点**: 无需改动
**缺点**: 问题继续存在，技术债增加

### 方案 B: 拆分为三个独立项目
**优点**: 完全隔离
**缺点**:
- 共用代码无法复用
- 版本管理更复杂
- 部署更麻烦

### 方案 C: Yarn Workspaces 而非 npm
**考虑**: npm v7+ 已支持 workspace，无需额外依赖

### 方案 D: 微前端 (Module Federation)
**优点**: 独立部署，动态加载
**缺点**:
- 过于复杂
- 团队学习成本高
- 当前规模不需要

**选择**: 方案 A 是采用 npm workspace 的 monorepo

---

## 相关决定

- **ADR-002**: 前端构建工具选择 (webpack vs vite)
- **ADR-003**: 插件和页面的通信方式
- **ADR-004**: 前端测试策略

---

## 后续行动

1. **本周**:
   - [ ] 团队评审本 ADR
   - [ ] 获得批准

2. **下周**:
   - [ ] 创建迁移计划详细任务分解
   - [ ] 分配开发人员
   - [ ] 开始 Phase 1 实施

3. **持续**:
   - [ ] 每周更新迁移进度
   - [ ] 记录遇到的问题和解决方案
   - [ ] 向团队分享学习心得

---

## 参考资源

- [npm workspaces 文档](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Monorepo 最佳实践](https://monorepo.tools/)
- [Chrome Extension 开发指南](https://developer.chrome.com/docs/extensions/mv3/)

---

## 反馈和讨论

- 对本方案有疑问？提出来讨论
- 发现不可行的地方？提供替代方案
- 有更好的想法？让我们改进计划

---

**下一步**: 等待团队反馈，确认是否进行迁移
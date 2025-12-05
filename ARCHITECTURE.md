# MixRead 架构设计文档

## 当前问题分析

### 三个前端部分的现状

```
MixRead 项目
├── Backend (Python FastAPI)
│   └── API 服务
│
├── 浏览器插件 (Chrome Extension)
│   ├── content.js (内容脚本)
│   ├── popup.js (弹出窗口)
│   └── manifest.json
│
├── 前端页面 1: 单词库页面 (library viewer)
│   └── library-viewer.html
│
├── 前端页面 2: 复习学习页面 (review session)
│   └── review-session.html
│   └── review-manager.js
│
└── 前端页面 3: 其他功能页面 (统计、设置等)
```

### 当前存在的问题

#### 1. **代码重复**
- 都需要：API 客户端、用户管理、UI 组件
- 当前分散在各个目录中，没有统一管理

#### 2. **开发效率低下**
- 修改一个共用逻辑，需要在三个地方改
- 没有统一的开发工具链
- 每个部分有自己的依赖管理

#### 3. **部署复杂**
- 插件：需要打包为 `.crx` 文件
- 页面 1：需要部署为静态网站
- 页面 2：需要部署为静态网站
- 三个部分的版本管理分散

#### 4. **缺乏模块化**
- 没有清晰的边界划分
- 难以测试
- 难以复用

---

## 解决方案：统一的前端架构

### 整体架构图

```
MixRead Frontend Monorepo
├── packages/
│   ├── shared/              # 共用模块 (🔴 不能被 web 访问)
│   │   ├── api-client/      # API 请求客户端
│   │   ├── hooks/           # React/通用 hooks
│   │   ├── utils/           # 工具函数 (日期、格式化等)
│   │   ├── components/      # 无状态 UI 组件
│   │   └── types/           # TypeScript 类型定义
│   │
│   ├── chrome-extension/    # 浏览器插件
│   │   ├── src/
│   │   │   ├── content/     # 内容脚本
│   │   │   ├── popup/       # 弹出窗口
│   │   │   ├── background/  # 后台脚本
│   │   │   └── manifest.json
│   │   ├── build/           # 构建输出
│   │   └── package.json
│   │
│   ├── review-page/         # 复习学习页面
│   │   ├── src/
│   │   │   ├── pages/       # 页面
│   │   │   ├── components/  # 页面特定组件
│   │   │   ├── app.js       # 应用入口
│   │   │   └── index.html
│   │   ├── build/           # 构建输出
│   │   └── package.json
│   │
│   ├── library-page/        # 单词库页面
│   │   ├── src/
│   │   │   ├── pages/       # 页面
│   │   │   ├── components/  # 页面特定组件
│   │   │   ├── app.js       # 应用入口
│   │   │   └── index.html
│   │   ├── build/           # 构建输出
│   │   └── package.json
│   │
│   └── admin-page/          # 管理界面 (可选)
│       └── ...
│
├── apps/                    # 应用配置
│   ├── extension-build/     # 插件构建脚本
│   ├── web-deploy/          # Web 部署脚本
│   └── docker-compose.yml   # 本地开发环境
│
├── docs/                    # 文档
│   ├── architecture/
│   ├── api-contracts/
│   └── development/
│
├── scripts/                 # 构建和部署脚本
│   ├── build-extension.sh
│   ├── build-pages.sh
│   ├── deploy.sh
│   └── version-bump.sh
│
└── package.json             # 根 package.json (workspace)
```

---

## 1. 共用模块层 (packages/shared)

### 1.1 API 客户端 (api-client)

**目的**: 统一的 API 请求管理，避免重复代码

```javascript
// packages/shared/api-client/src/client.js
export class APIClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  // 会话相关
  async createSession(userId, sessionType = 'mixed') { }
  async submitAnswer(userId, sessionId, quality) { }
  async getStats(userId) { }

  // 单词库相关
  async getVocabulary(userId) { }
  async addWord(userId, word) { }
  async removeWord(userId, word) { }

  // 单词信息
  async getWordInfo(word) { }
  async searchWords(query) { }
}

export default new APIClient();
```

**使用示例**:
```javascript
// 在插件中使用
import apiClient from '@mixread/api-client';
const session = await apiClient.createSession(userId, 'mixed');

// 在页面中使用
import { apiClient } from '@mixread/shared';
const words = await apiClient.getVocabulary(userId);
```

### 1.2 工具函数 (utils)

```
packages/shared/utils/
├── date.js          # 日期处理
├── format.js        # 格式化
├── storage.js       # localStorage 封装
├── validator.js     # 数据验证
└── logger.js        # 日志工具
```

### 1.3 UI 组件库 (components)

```
packages/shared/components/
├── Button/
├── Card/
├── Modal/
├── ProgressBar/
├── QualitySelector/  # 复习页面的质量选择器
└── WordCard/         # 单词卡片
```

### 1.4 Hooks (hooks)

```javascript
// packages/shared/hooks/useAPI.js
export function useAPI(apiMethod) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (...args) => {
    setLoading(true);
    try {
      const result = await apiMethod(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
}
```

---

## 2. 三个应用层

### 2.1 浏览器插件 (chrome-extension)

**职责**:
- 在网页上进行单词标注
- 提供快速入口到单词库和复习页面

**特点**:
- 不能直接访问 shared 包的 components（isolated context）
- 可以使用 shared 的 api-client、utils、hooks
- 独立的样式

**结构**:
```
chrome-extension/
├── src/
│   ├── content/
│   │   ├── injector.js        # 注入逻辑
│   │   ├── word-highlighter.js # 单词高亮
│   │   └── styles/
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   ├── background/
│   │   └── service-worker.js
│   └── shared/                # 插件专用共用代码
│       └── constants.js
├── manifest.json
└── package.json
```

### 2.2 复习页面 (review-page)

**职责**:
- 显示复习卡片
- 处理用户的学习反馈
- 展示学习统计

**特点**:
- 独立的 HTML 页面
- 可以使用所有 shared 模块
- 可以是 HTML + JS 或 React/Vue

**结构**:
```
review-page/
├── src/
│   ├── pages/
│   │   └── ReviewSession.js
│   ├── components/
│   │   ├── Card.js
│   │   ├── QualityButtons.js
│   │   └── ProgressBar.js
│   ├── managers/
│   │   └── ReviewManager.js    # 业务逻辑
│   ├── app.js
│   └── index.html
├── public/
│   └── index.html
└── package.json
```

### 2.3 单词库页面 (library-page)

**职责**:
- 显示用户的单词列表
- 搜索、过滤单词
- 管理单词（删除、添加标签等）

**特点**:
- 独立的 HTML 页面
- 可以使用所有 shared 模块
- 可以从插件快速跳转过来

**结构**:
```
library-page/
├── src/
│   ├── pages/
│   │   └── VocabularyLibrary.js
│   ├── components/
│   │   ├── WordList.js
│   │   ├── SearchBar.js
│   │   └── WordStats.js
│   ├── app.js
│   └── index.html
├── public/
│   └── index.html
└── package.json
```

---

## 3. 共享与隔离策略

### 3.1 什么应该共享（shared 包）

✅ **可以共享**:
- API 客户端
- 工具函数（日期、格式化）
- 类型定义 (TypeScript)
- 常量定义
- 通用 Hooks
- 无状态 UI 组件（但可能样式不同）
- 业务逻辑（如 SRS 算法计算）

### 3.2 什么应该隔离（各自的包）

❌ **必须隔离**:
- 样式/CSS（插件的 CSS 不能污染页面，反之亦然）
- HTML 结构（插件 popup 和页面的 DOM 结构不同）
- 路由管理（插件没有路由）
- 构建配置（webpack 配置不同）
- 包依赖（插件可能需要不同版本）

### 3.3 插件与页面的通信

**场景 1**: 插件打开单词库页面
```javascript
// 在插件 popup.js 中
document.getElementById('library-btn').addEventListener('click', () => {
  const libraryPageURL = `http://localhost:8001/library?user_id=${userId}`;
  chrome.tabs.create({ url: libraryPageURL });
});
```

**场景 2**: 页面返回插件（深度链接）
```javascript
// 在 review-page 或 library-page 中
const backToExtension = () => {
  // 关闭标签页，返回原始页面
  window.close();
};
```

**场景 3**: 插件和页面共享用户状态
```javascript
// 使用 chrome.storage 或 localStorage 同步
// 注意：需要考虑跨域问题
```

---

## 4. 构建和部署策略

### 4.1 开发模式

```bash
# 方案：Monorepo + 本地开发服务器

# 1. 安装依赖
npm install

# 2. 启动所有本地服务
npm run dev
# 这会启动：
# - Backend: http://localhost:8000
# - review-page: http://localhost:8001/review
# - library-page: http://localhost:8001/library
# - 插件: chrome://extensions → 加载未打包的扩展程序

# 3. 开发插件
npm run dev:extension
# 输出到 dist/extension，手动加载到 Chrome

# 4. 开发页面
npm run dev:pages
# 启动 web 服务器，支持热更新

# 5. 运行测试
npm run test
npm run test:integration
```

### 4.2 生产部署

```bash
# 1. 构建所有包
npm run build

# 输出：
# dist/
# ├── extension/           # 生产级插件
# │   ├── manifest.json
# │   ├── popup.html
# │   └── ...
# │
# ├── review-page/         # 生产页面
# │   └── index.html
# │
# └── library-page/        # 生产页面
#     └── index.html

# 2. 部署插件
npm run deploy:extension
# 上传到 Chrome Web Store

# 3. 部署页面
npm run deploy:pages
# 部署到服务器（AWS S3、Vercel 等）

# 4. 部署后端（已有）
cd backend && npm run deploy:docker
```

### 4.3 版本管理

```json
{
  "version": "1.2.3",
  "packages": {
    "shared": "1.2.3",
    "chrome-extension": "1.2.3",
    "review-page": "1.2.3",
    "library-page": "1.2.3",
    "backend": "1.2.3"
  }
}
```

---

## 5. 插件的快速入口设计

### 5.1 从插件打开单词库

```javascript
// chrome-extension/src/popup/popup.js
import { openPage } from '@mixread/shared/utils/browser';

document.getElementById('library-btn').addEventListener('click', () => {
  openPage('library', { userId: getUserId() });
});

// 实现
export function openPage(pageName, params = {}) {
  const pages = {
    'library': 'https://mixread.app/library',
    'review': 'https://mixread.app/review',
    'stats': 'https://mixread.app/stats'
  };

  const url = new URL(pages[pageName]);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  chrome.tabs.create({ url: url.toString() });
}
```

### 5.2 从插件在当前页面添加单词到库

```javascript
// chrome-extension/src/content/word-interaction.js
import { apiClient } from '@mixread/shared';

// 右键菜单：添加单词到库
chrome.contextMenus.create({
  id: 'add-to-library',
  title: 'Add to Vocabulary',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'add-to-library') {
    const word = info.selectionText;
    await apiClient.addWord(userId, word);

    // 通知用户
    showNotification(`Added "${word}" to your vocabulary`);

    // 可选：打开单词库页面
    openPage('library', {
      userId: userId,
      scrollToWord: word
    });
  }
});
```

### 5.3 从单词库快速开始复习

```javascript
// library-page/src/pages/VocabularyLibrary.js
import { openPage } from '@mixread/shared/utils/browser';

function startReview() {
  openPage('review', {
    userId: userId,
    sessionType: 'mixed'
  });
}
```

---

## 6. 具体的文件结构示例

### 当前结构 ❌

```
frontend/
├── modules/review/
│   └── review-manager.js      # 复习逻辑
├── pages/
│   ├── review-session.html    # 复习页面
│   └── library-viewer.html    # 单词库页面
├── content.js                 # 插件内容脚本
└── manifest.json              # 插件配置
```

### 改进后的结构 ✅

```
frontend-monorepo/
├── packages/
│   ├── shared/
│   │   ├── api-client/
│   │   │   ├── src/
│   │   │   │   ├── index.js
│   │   │   │   ├── session.js
│   │   │   │   ├── vocabulary.js
│   │   │   │   └── words.js
│   │   │   └── package.json
│   │   │
│   │   ├── utils/
│   │   │   ├── src/
│   │   │   │   ├── browser.js
│   │   │   │   ├── date.js
│   │   │   │   ├── storage.js
│   │   │   │   └── logger.js
│   │   │   └── package.json
│   │   │
│   │   ├── hooks/
│   │   │   ├── src/
│   │   │   │   ├── useAPI.js
│   │   │   │   ├── useStorage.js
│   │   │   │   └── useUser.js
│   │   │   └── package.json
│   │   │
│   │   └── components/
│   │       ├── src/
│   │       │   ├── Button.js
│   │       │   ├── Card.js
│   │       │   └── Modal.js
│   │       └── package.json
│   │
│   ├── chrome-extension/
│   │   ├── src/
│   │   │   ├── content/
│   │   │   │   ├── index.js
│   │   │   │   ├── word-highlighter.js
│   │   │   │   ├── context-menu.js
│   │   │   │   └── styles.css
│   │   │   ├── popup/
│   │   │   │   ├── popup.html
│   │   │   │   ├── popup.js
│   │   │   │   └── popup.css
│   │   │   ├── background/
│   │   │   │   └── service-worker.js
│   │   │   └── manifest.json
│   │   ├── dist/               # 构建输出
│   │   └── package.json
│   │
│   ├── review-page/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   └── ReviewSession.js
│   │   │   ├── components/
│   │   │   │   ├── Card.js
│   │   │   │   ├── QualityButtons.js
│   │   │   │   └── ProgressBar.js
│   │   │   ├── styles/
│   │   │   │   └── index.css
│   │   │   ├── app.js
│   │   │   └── index.html
│   │   ├── dist/               # 构建输出
│   │   └── package.json
│   │
│   └── library-page/
│       ├── src/
│       │   ├── pages/
│       │   │   └── VocabularyLibrary.js
│       │   ├── components/
│       │   │   ├── WordList.js
│       │   │   ├── SearchBar.js
│       │   │   └── WordStats.js
│       │   ├── styles/
│       │   │   └── index.css
│       │   ├── app.js
│       │   └── index.html
│       ├── dist/               # 构建输出
│       └── package.json
│
├── scripts/
│   ├── build.js
│   ├── deploy.js
│   └── version.js
│
├── docs/
│   ├── ARCHITECTURE.md          # 本文件
│   ├── DEVELOPMENT.md
│   └── DEPLOYMENT.md
│
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── build.yml
│       └── deploy.yml
│
├── package.json                 # Workspace root
└── .npmrc                        # Workspace 配置
```

---

## 7. 实施步骤

### Phase 1: 建立 Monorepo 结构 (1 周)
- [ ] 迁移代码到 packages/ 目录
- [ ] 设置 npm workspace
- [ ] 创建根 package.json
- [ ] 配置 build 脚本

### Phase 2: 提取共用模块 (1-2 周)
- [ ] 创建 @mixread/shared-api-client
- [ ] 创建 @mixread/shared-utils
- [ ] 创建 @mixread/shared-hooks
- [ ] 更新三个应用的依赖

### Phase 3: 优化构建流程 (1 周)
- [ ] 配置 webpack/rollup
- [ ] 设置开发模式 (npm run dev)
- [ ] 设置生产构建 (npm run build)
- [ ] 配置热更新

### Phase 4: 实现快速入口 (1 周)
- [ ] 插件 → 单词库页面
- [ ] 插件 → 复习页面
- [ ] 页面 → 插件返回
- [ ] 深度链接支持

### Phase 5: 部署和文档 (1 周)
- [ ] 配置 CI/CD
- [ ] 编写开发指南
- [ ] 编写部署指南
- [ ] 版本管理策略

---

## 8. 好处总结

| 方面 | 改进 |
|------|------|
| **代码复用** | 80% → 95% (shared 模块中) |
| **开发效率** | 修改一次，三个地方同时更新 |
| **维护性** | 清晰的边界和依赖关系 |
| **测试** | 每个模块独立测试 |
| **部署** | 独立版本控制，可以分开部署 |
| **扩展** | 容易添加新的前端应用 |

---

## 9. 风险和注意事项

⚠️ **Chrome 插件 CSP 限制**
- 不能使用 eval、动态 require
- 注入脚本需要特殊处理
- 样式隔离：使用 Shadow DOM

⚠️ **跨域问题**
- 插件 popup 和 content script 在不同上下文
- 使用 chrome.runtime.sendMessage 通信
- Web 页面和 localhost 的 CORS 问题

⚠️ **存储同步**
- 用户数据在多个地方：localStorage、chrome.storage、服务器
- 需要同步策略
- 离线时的处理

---

## 下一步

1. 评估这个架构是否符合项目需求
2. 确认是否采纳这个方案
3. 制定详细的迁移计划
4. 开始 Phase 1 实施
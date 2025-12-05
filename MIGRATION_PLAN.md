# MixRead 前端架构迁移计划

## 摘要
将当前分散的前端代码重组成 Monorepo 结构，统一管理三个前端部分（插件、复习页、单词库页）的开发和部署。

---

## Phase 1: 建立 Monorepo 基础 (第 1-2 周)

### 1.1 创建目录结构

```bash
# 当前位置: /Users/yinshucheng/code/creo/MixRead/frontend
# 迁移到新结构

# 1. 在 MixRead 根目录创建 frontend-monorepo
mkdir -p frontend-monorepo/packages/shared
mkdir -p frontend-monorepo/packages/chrome-extension
mkdir -p frontend-monorepo/packages/review-page
mkdir -p frontend-monorepo/packages/library-page
mkdir -p frontend-monorepo/scripts
mkdir -p frontend-monorepo/docs

# 2. 保留原 frontend 目录作为参考（以后删除）
# cp -r frontend frontend-backup
```

### 1.2 创建根 package.json (Workspace)

```json
{
  "name": "@mixread/frontend",
  "version": "1.0.0",
  "private": true,
  "description": "MixRead Frontend Monorepo",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspaces",
    "dev:extension": "npm run dev --workspace=packages/chrome-extension",
    "dev:pages": "npm run dev --workspace=packages/review-page && npm run dev --workspace=packages/library-page",
    "build": "npm run build --workspaces",
    "build:extension": "npm run build --workspace=packages/chrome-extension",
    "build:pages": "npm run build --workspace=packages/review-page && npm run build --workspace=packages/library-page",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces",
    "clean": "npm run clean --workspaces && rm -rf node_modules"
  },
  "devDependencies": {
    "webpack": "^5.x",
    "webpack-cli": "^5.x",
    "webpack-dev-server": "^4.x",
    "babel-loader": "^9.x",
    "@babel/core": "^7.x",
    "@babel/preset-env": "^7.x"
  }
}
```

### 1.3 迁移现有代码

**当前代码位置**:
```
frontend/
├── modules/review/review-manager.js      → packages/review-page/src/
├── pages/review-session.html             → packages/review-page/src/
├── pages/library-viewer.html             → packages/library-page/src/
├── content.js                            → packages/chrome-extension/src/content/
└── manifest.json                         → packages/chrome-extension/src/
```

**迁移步骤**:
1. 复制文件到新位置
2. 保留原位置（作为备份）
3. 更新导入路径
4. 运行测试验证

---

## Phase 2: 创建 Shared 包 (第 2-3 周)

### 2.1 创建 @mixread/api-client 包

**文件结构**:
```
packages/shared/api-client/
├── src/
│   ├── index.js              # 导出公共接口
│   ├── client.js             # API 客户端主类
│   ├── session.js            # 会话 API
│   ├── vocabulary.js         # 单词库 API
│   ├── words.js              # 单词 API
│   └── types.js              # TypeScript 类型
├── package.json
└── README.md
```

**实现示例** (packages/shared/api-client/src/client.js):

```javascript
class APIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:8000';
    this.timeout = options.timeout || 10000;
  }

  async request(endpoint, options = {}) {
    const url = new URL(endpoint, this.baseURL);

    // 构建查询参数
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: this.timeout
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // === 会话相关 API ===
  async createSession(userId, sessionType = 'mixed') {
    return this.request(`/users/${userId}/review/session`, {
      method: 'POST',
      body: { session_type: sessionType }
    });
  }

  async submitAnswer(userId, sessionId, quality) {
    return this.request(
      `/users/${userId}/review/answer`,
      {
        method: 'POST',
        query: { session_id: sessionId, quality }
      }
    );
  }

  async getStats(userId, period = 'week') {
    return this.request(`/users/${userId}/review/stats`, {
      query: { period }
    });
  }

  // === 单词库相关 API ===
  async getVocabulary(userId) {
    return this.request(`/users/${userId}/vocabulary`);
  }

  async addWord(userId, word) {
    return this.request(`/users/${userId}/vocabulary`, {
      method: 'POST',
      body: { word }
    });
  }

  async removeWord(userId, word) {
    return this.request(`/users/${userId}/vocabulary/${word}`, {
      method: 'DELETE'
    });
  }

  // === 单词信息 API ===
  async getWordInfo(word) {
    return this.request(`/word/${word}`);
  }

  async batchWordInfo(words) {
    return this.request('/batch-word-info', {
      method: 'POST',
      body: { words }
    });
  }

  async highlightWords(userId, words, difficultyLevel = 'B1') {
    return this.request('/highlight-words', {
      method: 'POST',
      body: {
        user_id: userId,
        words,
        difficulty_level: difficultyLevel
      }
    });
  }
}

export default new APIClient();
export { APIClient };
```

### 2.2 创建 @mixread/utils 包

```
packages/shared/utils/
├── src/
│   ├── index.js
│   ├── date.js        # 日期处理
│   ├── string.js      # 字符串处理
│   ├── browser.js     # 浏览器 API 封装
│   ├── storage.js     # 存储工具
│   └── logger.js      # 日志工具
├── package.json
└── README.md
```

**示例** (packages/shared/utils/src/browser.js):

```javascript
// 打开应用页面（支持深度链接）
export function openPage(pageName, params = {}) {
  const pages = {
    'library': '/library',
    'review': '/review',
    'stats': '/stats'
  };

  const path = pages[pageName];
  if (!path) {
    throw new Error(`Unknown page: ${pageName}`);
  }

  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, JSON.stringify(value));
  });

  return url.toString();
}

// 从 URL 获取参数
export function getPageParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};

  for (const [key, value] of params) {
    try {
      result[key] = JSON.parse(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}
```

### 2.3 创建 @mixread/hooks 包

```javascript
// packages/shared/hooks/src/useAPI.js
export function useAPI(apiMethod) {
  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null
  });

  const execute = async (...args) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiMethod(...args);
      setState(s => ({ ...s, data, loading: false }));
      return data;
    } catch (error) {
      setState(s => ({ ...s, error, loading: false }));
      throw error;
    }
  };

  return { ...state, execute };
}

// packages/shared/hooks/src/useUser.js
export function useUser() {
  const [userId, setUserId] = useState(() => {
    // 从 URL 参数或 localStorage 获取
    const params = getPageParams();
    return params.user_id || localStorage.getItem('user_id');
  });

  return { userId, setUserId };
}
```

---

## Phase 3: 重构三个应用包 (第 3-4 周)

### 3.1 重构 chrome-extension 包

**package.json**:
```json
{
  "name": "@mixread/chrome-extension",
  "version": "1.0.0",
  "scripts": {
    "dev": "webpack --mode development --watch",
    "build": "webpack --mode production",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@mixread/api-client": "*",
    "@mixread/utils": "*"
  },
  "devDependencies": {
    "webpack": "^5.x",
    "webpack-cli": "^5.x",
    "copy-webpack-plugin": "^11.x"
  }
}
```

**webpack.config.js**:
```javascript
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    content: './src/content/index.js',
    popup: './src/popup/popup.js',
    background: './src/background/service-worker.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        // ... 其他静态文件
      ]
    })
  ]
};
```

**更新后的 content script** (packages/chrome-extension/src/content/index.js):

```javascript
import apiClient from '@mixread/api-client';
import { getPageParams, openPage } from '@mixread/utils';

// 初始化
const userId = localStorage.getItem('user_id') || 'default_user';

// 从插件向当前页面注入脚本
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content.bundle.js');
  document.documentElement.appendChild(script);
}

// 高亮单词
async function highlightWords() {
  const pageText = document.body.innerText;
  const words = pageText.match(/\b[a-z]+\b/gi) || [];

  const highlighted = await apiClient.highlightWords(userId, words);

  // 处理高亮...
}

// 右键菜单：添加单词
chrome.contextMenus.create({
  id: 'add-word',
  title: 'Add to Vocabulary',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'add-word') {
    const word = info.selectionText;
    await apiClient.addWord(userId, word);
    alert(`Added "${word}" to vocabulary`);
  }
});

// 从 popup 接收消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'open-page') {
    const url = openPage(request.page, request.params);
    chrome.tabs.create({ url });
  }
});
```

### 3.2 重构 review-page 包

**package.json** 结构类似，但没有 manifest 和 popup.html

**HTML 结构** (packages/review-page/src/index.html):

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MixRead - Review Session</title>
  <link rel="stylesheet" href="./styles/index.css">
</head>
<body>
  <div id="app"></div>
  <script src="./app.bundle.js"></script>
</body>
</html>
```

**应用入口** (packages/review-page/src/app.js):

```javascript
import apiClient from '@mixread/api-client';
import { getPageParams } from '@mixread/utils';
import ReviewManager from './pages/ReviewSession';

// 获取用户 ID 和其他参数
const params = getPageParams();
const userId = params.user_id || localStorage.getItem('user_id');
const sessionType = params.session_type || 'mixed';

// 初始化复习管理器
const reviewManager = new ReviewManager(userId, apiClient);

// 挂载到 DOM
document.addEventListener('DOMContentLoaded', () => {
  reviewManager.init();
  reviewManager.startSession(sessionType);
});
```

### 3.3 重构 library-page 包

类似结构，主要区别是显示单词列表和搜索功能

---

## Phase 4: 配置构建和开发工具 (第 4 周)

### 4.1 创建构建脚本

**scripts/build.js**:
```bash
#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');

const packages = [
  'packages/shared/api-client',
  'packages/shared/utils',
  'packages/shared/hooks',
  'packages/chrome-extension',
  'packages/review-page',
  'packages/library-page'
];

console.log('🔨 Building all packages...');

for (const pkg of packages) {
  console.log(`\n📦 Building ${pkg}...`);
  execSync(`npm run build --workspace=${pkg}`, { stdio: 'inherit' });
}

console.log('\n✅ Build complete!');
```

### 4.2 配置开发环境

**docker-compose.yml** (在项目根目录):

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: sqlite:///./mixread.db
    volumes:
      - ./backend:/app

  frontend-pages:
    image: node:18
    working_dir: /app
    ports:
      - "8001:8001"
    volumes:
      - ./frontend-monorepo:/app
    command: npm run serve:pages

  # 可选：本地开发的 nginx 代理
  proxy:
    image: nginx:latest
    ports:
      - "3000:3000"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### 4.3 配置 npm scripts

在根 package.json 中添加：

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && python main.py",
    "dev:frontend": "npm run dev --workspace=frontend-monorepo",
    "dev:extension": "npm run dev --workspace=packages/chrome-extension",
    "serve:pages": "npm install && npm run serve --workspace=packages/review-page && npm run serve --workspace=packages/library-page",
    "build": "npm run build --workspace=frontend-monorepo",
    "test": "npm run test --workspace=frontend-monorepo",
    "deploy": "npm run build && ./scripts/deploy.sh"
  },
  "devDependencies": {
    "concurrently": "^8.x"
  }
}
```

---

## Phase 5: 实现快速入口功能 (第 5 周)

### 5.1 插件打开单词库

修改 **packages/chrome-extension/src/popup/popup.js**:

```javascript
import { openPage } from '@mixread/utils';

document.getElementById('library-btn').addEventListener('click', () => {
  const userId = localStorage.getItem('user_id');
  const url = openPage('library', { userId });
  chrome.tabs.create({ url });
});

document.getElementById('review-btn').addEventListener('click', () => {
  const userId = localStorage.getItem('user_id');
  const url = openPage('review', { userId, sessionType: 'mixed' });
  chrome.tabs.create({ url });
});
```

### 5.2 页面返回插件

在 **packages/review-page/src/components/** 和 **packages/library-page/src/components/** 中：

```javascript
// 返回按钮
document.getElementById('back-btn')?.addEventListener('click', () => {
  // 关闭标签页，返回原始页面
  window.close();
});
```

### 5.3 深度链接支持

在两个页面的 app.js 中处理 URL 参数并预加载数据

---

## Phase 6: 部署和文档 (第 6 周)

### 6.1 GitHub Actions CI/CD

**.github/workflows/build.yml**:

```yaml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

### 6.2 部署脚本

**scripts/deploy.sh**:

```bash
#!/bin/bash

set -e

echo "🚀 Deploying MixRead..."

# 1. 构建所有包
echo "📦 Building packages..."
npm run build

# 2. 上传 Chrome 扩展
echo "🔌 Uploading Chrome extension..."
npm run deploy:extension

# 3. 部署 Web 页面
echo "🌐 Deploying web pages..."
npm run deploy:pages

# 4. 部署后端（如果需要）
echo "🔧 Deploying backend..."
cd backend && npm run deploy:docker

echo "✅ Deploy complete!"
```

### 6.3 编写文档

创建以下文档：
- `docs/ARCHITECTURE.md` - 架构说明（已创建）
- `docs/DEVELOPMENT.md` - 开发指南
- `docs/DEPLOYMENT.md` - 部署指南
- `docs/API.md` - API 文档
- `CONTRIBUTING.md` - 贡献指南

---

## 迁移清单

### 第 1 周
- [ ] 创建新的 monorepo 目录结构
- [ ] 创建根 package.json
- [ ] 复制现有代码到新位置
- [ ] 测试 shared 包的创建

### 第 2-3 周
- [ ] 创建 @mixread/api-client
- [ ] 创建 @mixread/utils
- [ ] 创建 @mixread/hooks
- [ ] 在三个应用中引入 shared 包

### 第 4 周
- [ ] 配置 webpack/rollup
- [ ] 创建构建脚本
- [ ] 配置开发环境
- [ ] 运行 npm run dev 验证

### 第 5 周
- [ ] 实现插件快速入口
- [ ] 实现页面返回按钮
- [ ] 实现深度链接
- [ ] 测试全流程

### 第 6 周
- [ ] 配置 CI/CD
- [ ] 编写文档
- [ ] 性能优化
- [ ] 代码审查

---

## 成功标志

✅ `npm install` 成功安装所有依赖
✅ `npm run dev` 启动所有服务
✅ 插件能够打开单词库页面
✅ 单词库页面能够返回插件
✅ 所有测试通过
✅ 生产构建大小 < 预期值
✅ 文档完整

---

## 预期收益

| 指标 | 现在 | 迁移后 |
|------|------|--------|
| 代码重复率 | 30-40% | < 10% |
| 构建时间 | 各自独立 | 统一 < 30s |
| 新功能开发时间 | 3+ 个地方改 | 1-2 个地方改 |
| 依赖管理复杂度 | 高 | 低 |
| 部署步骤 | 3 个独立流程 | 1 个统一流程 |
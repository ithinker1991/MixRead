# 域名排除功能 - 实现路线图

**目标**: 快速完成 Phase 1 MVP，用户可配置网站排除列表 + 预设建议 + 云端同步

**预计周期**: 3 周 (Week 1-3)

---

## Phase 1: MVP (Week 1-3)

### Week 1: 核心存储和匹配逻辑

#### Day 1-2: ExclusionStore 模块

**文件**: `frontend/modules/exclusion/exclusion-store.js`

```javascript
class ExclusionStore {
  // 架构决策后的实现细节

  async isSyncAvailable() {
    // 检测用户是否登录 Chrome 账户
    // 返回: true (使用 sync) 或 false (降级到 local)
  }

  async getExcludedDomains() {
    // 获取排除列表，自动选择 sync 或 local 存储
  }

  async addDomain(domain) {
    // 添加域名，自动保存到选定的存储
  }

  async removeDomain(domain) {
    // 删除域名
  }

  async saveDomains(domains) {
    // 批量保存，触发同步
  }

  isDomainExcluded(url) {
    // 检查 URL 是否被排除
  }

  matchesDomain(url, excludedDomains) {
    // 域名匹配逻辑 (精确、通配符、IP、file://)
  }

  onSyncedDomainsChanged(callback) {
    // 监听其他设备的同步更新
  }
}
```

**测试**:
```javascript
// ✅ 测试项
[ ] addDomain() 正确保存
[ ] getExcludedDomains() 返回完整列表
[ ] removeDomain() 正确删除
[ ] matchesDomain() 精确匹配 github.com
[ ] matchesDomain() 通配符匹配 localhost:*
[ ] matchesDomain() IP 地址匹配 127.0.0.1:8000
[ ] matchesDomain() file:// 协议匹配
[ ] 存储大小 < 100KB (Chrome Cloud Sync 限制)
```

**参考**: CLOUD_SYNC_IMPLEMENTATION_GUIDE.md 的第 46-164 行

---

#### Day 3: ExclusionFilter 模块

**文件**: `frontend/modules/exclusion/exclusion-filter.js`

```javascript
class ExclusionFilter {
  async shouldExcludeDomain(url) {
    // 根据当前 URL 判断是否应该排除
    const excluded = await exclusionStore.getExcludedDomains();
    return exclusionStore.matchesDomain(url, excluded);
  }
}
```

**集成点**: `content.js` 中在初始化前检查

```javascript
// content.js 顶部
if (await exclusionFilter.shouldExcludeDomain(window.location.href)) {
  console.log('[MixRead] 此网站被排除，不加载插件');
  return; // 提前退出，不加载任何功能
}

// 否则继续加载高亮、Popup 等
initializeHighlight();
```

**测试**:
```javascript
[ ] localhost:8002 被排除 → 不加载
[ ] github.com 未被排除 → 正常加载
[ ] 多个排除域名 → 全部工作
```

---

### Week 2: UI 和预设对话框

#### Day 1-2: 更新 Popup UI

**文件**: `frontend/popup.html` 和 `frontend/popup.js`

**UI 结构**:
```html
<div id="current-page">
  <!-- 当前页面控制 -->
  <h3>当前页面</h3>
  <p>Domain: <span id="current-domain">...</span></p>
  <p>Status: <span id="current-status">✓ 启用</span></p>
  <button id="toggle-current">禁用此网站</button>
</div>

<div id="excluded-list">
  <!-- 排除列表显示 -->
  <h3>被排除的网站 (<span id="count">3</span>)</h3>
  <ul id="domains-list">
    <!-- 动态生成的列表 -->
  </ul>
</div>

<div id="add-domain">
  <!-- 添加新域名 -->
  <input type="text" id="new-domain" placeholder="输入域名...">
  <button id="add-btn">添加</button>
</div>
```

**事件处理**:
```javascript
// 禁用/启用当前网站
document.getElementById('toggle-current').addEventListener('click', async () => {
  const domain = getCurrentDomain();
  const excluded = await exclusionStore.getExcludedDomains();

  if (excluded.includes(domain)) {
    await exclusionStore.removeDomain(domain);
    showNotification('已从排除列表删除');
  } else {
    await exclusionStore.addDomain(domain);
    showNotification('已添加到排除列表，刷新页面生效');
  }

  updateUI();
});

// 添加新域名
document.getElementById('add-btn').addEventListener('click', async () => {
  const domain = document.getElementById('new-domain').value.trim();
  if (domain) {
    await exclusionStore.addDomain(domain);
    updateUI();
  }
});

// 删除域名
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const domain = e.target.dataset.domain;
    await exclusionStore.removeDomain(domain);
    updateUI();
  }
});
```

**更新 manifest.json**:
```json
{
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"]
}
```

**测试**:
```javascript
[ ] Popup 正确显示当前域名
[ ] 点击"禁用此网站"添加到列表
[ ] 排除列表正确显示
[ ] 点击删除按钮移除域名
[ ] 输入新域名并添加
```

---

#### Day 3: 预设建议对话框

**文件**: `frontend/modules/exclusion/preset-dialog.js` (新建)

```javascript
const PRESET_EXCLUSIONS = {
  // 本地开发
  "localhost:8002": "MixRead 库页面",
  "localhost:3000": "React/Vue 开发服务器",
  "127.0.0.1:8000": "本地后端 API",
  "localhost:5173": "Vite 开发服务器",

  // 生产工具
  "jenkins.company.com": "Jenkins",
  "gitlab.company.com": "GitLab",
  "jira.company.com": "Jira",

  // 通用
  "file://": "本地文件",
  "mail.google.com": "Gmail"
};

class PresetDialog {
  async showDialog() {
    // 首次使用时显示对话框
    const isFirstTime = !localStorage.getItem('mixread_first_time_setup');

    if (isFirstTime) {
      const selected = await this.renderDialog(PRESET_EXCLUSIONS);

      if (selected.length > 0) {
        const current = await exclusionStore.getExcludedDomains();
        const merged = [...new Set([...current, ...selected])];
        await exclusionStore.saveDomains(merged);
      }

      localStorage.setItem('mixread_first_time_setup', 'true');
    }
  }

  async renderDialog(presets) {
    // 返回用户选择的预设列表
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'preset-dialog';

      // UI 代码...
      // 返回选定的域名
    });
  }
}
```

**对话框 UI**:
```html
<div class="preset-dialog">
  <h2>👋 欢迎使用 MixRead</h2>
  <p>要排除这些网站的高亮吗？</p>

  <div class="preset-group">
    <h4>本地开发 (建议)</h4>
    <label><input type="checkbox" checked> localhost:8002 (库页面)</label>
    <label><input type="checkbox" checked> localhost:3000 (开发服务器)</label>
    <label><input type="checkbox" checked> 127.0.0.1:8000 (本地 API)</label>
    <label><input type="checkbox" checked> localhost:5173 (Vite)</label>
  </div>

  <div class="preset-group">
    <h4>生产工具</h4>
    <label><input type="checkbox"> jenkins.company.com</label>
    <label><input type="checkbox"> gitlab.company.com</label>
    <label><input type="checkbox"> jira.company.com</label>
  </div>

  <div class="preset-group">
    <h4>其他</h4>
    <label><input type="checkbox" checked> file://</label>
    <label><input type="checkbox"> mail.google.com</label>
  </div>

  <button class="apply">✓ 应用</button>
  <button class="skip">× 跳过</button>
</div>
```

**CSS** (popup.css):
```css
.preset-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  z-index: 10000;
  max-width: 400px;
}

.preset-dialog h2 {
  margin: 0 0 10px 0;
  font-size: 18px;
}

.preset-group {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
}

.preset-group label {
  display: block;
  margin: 8px 0;
  cursor: pointer;
}

.preset-dialog button {
  padding: 10px 20px;
  margin: 5px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.preset-dialog .apply {
  background: #4CAF50;
  color: white;
}

.preset-dialog .skip {
  background: #f0f0f0;
  color: #333;
}
```

**测试**:
```javascript
[ ] 新用户首次打开 → 显示对话框
[ ] 已有用户 → 不显示对话框
[ ] 用户选择应用 → 预设添加到列表
[ ] 用户选择跳过 → 对话框关闭
[ ] 下次打开不再显示 → first_time_setup 标志正常工作
```

---

### Week 3: 集成和完整测试

#### Day 1: content.js 集成

**在 `content.js` 加载时检查排除列表**:

```javascript
// content.js 顶部，在任何高亮初始化之前
async function checkAndInitialize() {
  try {
    // 1. 检查排除列表
    const filter = new ExclusionFilter();
    if (await filter.shouldExcludeDomain(window.location.href)) {
      console.log('[MixRead] 此网站被排除，停止加载');
      return; // 完全退出，不加载任何功能
    }

    // 2. 初始化模块
    await initializeModules();

    // 3. 获取页面内容
    const pageContent = extractPageContent();

    // 4. 发送到后端处理
    const highlightData = await apiClient.getHighlightWords({
      user_id: userId,
      content: pageContent,
      difficulty_level: userLevel
    });

    // 5. 应用高亮
    applyHighlighting(highlightData);

  } catch (error) {
    console.error('[MixRead] 初始化失败:', error);
    // 继续执行，不中断用户体验
  }
}

// 等待 DOM 准备好后开始
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndInitialize);
} else {
  checkAndInitialize();
}
```

**Popup 初始化**:
```javascript
// popup.js
async function initializePopup() {
  // 显示预设对话框 (仅首次)
  const presetDialog = new PresetDialog();
  await presetDialog.showDialog();

  // 加载并显示排除列表
  const exclusionStore = new ExclusionStore();
  const domains = await exclusionStore.getExcludedDomains();

  updateDomainsList(domains);

  // 监听其他设备的同步更新
  exclusionStore.onSyncedDomainsChanged((newDomains) => {
    updateDomainsList(newDomains);
    showNotification('配置已从其他设备同步');
  });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializePopup);
```

---

#### Day 2-3: 完整功能测试

**测试场景 1: 基础排除**
```javascript
[ ] 新用户安装 → 显示预设对话框
[ ] 选择预设 → localhost:8002 被添加
[ ] 访问 localhost:8002 → 无高亮
[ ] 访问 github.com → 正常高亮
[ ] 删除 localhost:8002 → 下次访问有高亮
```

**测试场景 2: 多域名匹配**
```javascript
[ ] 添加 "localhost:*" → 匹配 localhost:8000-8100
[ ] 添加 "api.github.com" → 精确匹配子域名
[ ] 添加 "127.0.0.1:*" → 通配符匹配所有端口
[ ] 添加 "file://" → 匹配本地文件
```

**测试场景 3: 云端同步** (Chrome Cloud Sync 方案)
```javascript
// 设备 A
[ ] 添加排除域名 → chrome.storage.sync 正确保存
[ ] 检查 DevTools → Application → Storage 中有数据

// 设备 B (同一 Google 账户)
[ ] 安装 MixRead → 自动下载设备 A 的配置
[ ] 排除列表显示相同的域名
[ ] 验证 ~1 秒内同步完成

// 离线场景
[ ] 设备 A 离线 → 本地修改
[ ] 设备 A 恢复网络 → 自动上传到 Google Cloud
[ ] 设备 B 收到更新
```

**测试场景 4: 降级场景** (未登录 Chrome 账户)
```javascript
[ ] 用户未登录 Google → 检查 isSyncAvailable() = false
[ ] 自动使用 chrome.storage.local
[ ] 本地存储完全正常工作
[ ] 添加 / 删除 / 匹配均正确
```

**性能测试**
```javascript
[ ] 排除列表检查 < 10ms (即使 1000 个域名)
[ ] 对话框加载 < 100ms
[ ] 无内存泄漏 (访问 100 个网站后观察 DevTools Memory)
[ ] 无 Console 错误
```

**边界情况测试**
```javascript
[ ] 添加重复域名 → 去重正确
[ ] 添加空字符串 → 拒绝或提示
[ ] 添加超长域名 → 存储限制检查
[ ] 快速点击多次添加 → 防抖/节流正确
[ ] 同时编辑多个标签页 → 同步冲突解决
```

---

## 部署清单

### 发布前验证

```javascript
[ ] 所有单元测试通过
[ ] 功能测试场景全部通过
[ ] 性能测试目标达成 (<10ms)
[ ] 没有 Console 错误
[ ] DevTools Network 正常 (无 CORS 错误)
[ ] 多浏览器测试 (Chrome, Edge, Brave)
[ ] 隐私政策更新 (说明配置云端同步)
[ ] 用户文档完成 (如何使用排除列表)
```

### Chrome Store 发布

```javascript
[ ] 更新 manifest.json 版本号
[ ] 更新 package.json 版本号
[ ] 创建 CHANGELOG 条目
[ ] 生成新的 .pem 私钥文件 (或使用既有)
[ ] 打包扩展
[ ] 上传到 Chrome Web Store
[ ] 提交审核
[ ] 等待 1-3 天审批
[ ] 发布！
```

---

## Phase 2: 增强功能 (未来)

```
Week 1-2:
  [ ] 导入/导出 JSON
  [ ] UI 优化
  [ ] 高级匹配规则 (正则表达式)
  [ ] 预设管理页面

Week 3-4:
  [ ] 分类管理 (开发/生产/个人)
  [ ] 搜索和过滤
  [ ] 快速开关
  [ ] 统计信息
```

---

## 参考文档

- **完整 PRD**: `PRD_EXCLUDE_DOMAINS_FEATURE.md`
- **快速参考**: `QUICK_REFERENCE_PRESET_FEATURE.md`
- **Cloud Sync 实现**: `CLOUD_SYNC_IMPLEMENTATION_GUIDE.md` (如选择此方案)
- **架构决策**: `ARCHITECTURE_DECISION_SUMMARY.md`

---

**状态**: 🔄 等待架构决策 → 立即开始开发

一旦确认选择 Chrome Cloud Sync 或自托管方案，可以按照本路线图立即启动 Week 1！


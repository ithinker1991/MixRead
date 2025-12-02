# PRD: 域名黑名单/排除功能

**版本**: 1.0
**日期**: 2025-12-02
**优先级**: 中等
**涉及阶段**: Phase 1 MVP扩展功能

---

## 1. 概述

### 问题陈述
MixRead 插件目前在所有网站上都启动并高亮单词,但某些网站(如库管理页面 `localhost:8002/library-viewer.html`)不需要或不适合进行单词高亮,导致页面显示混乱。

用户需要**能够控制哪些网站启动插件,哪些网站禁用**。

### 解决方案概览
实现**域名黑名单功能**,允许用户:
1. **在popup中管理排除列表** - 添加/删除域名
2. **快速切换** - 当前页面一键禁用/启用
3. **预设列表** - 内置推荐的排除域名
4. **智能识别** - 自动检测本地服务(localhost)

---

## 2. 功能需求

### 2.1 核心功能

#### F1: 排除域名列表管理
**描述**: 用户可以管理一个域名黑名单

**具体需求**:
- 存储排除域名列表(本地storage)
- 支持添加新域名
- 支持删除已有域名
- 支持查看当前排除列表
- 支持导入/导出列表(JSON格式)

**数据结构**:
```javascript
{
  excluded_domains: [
    "localhost:8002",
    "localhost:3000",
    "127.0.0.1:8000",
    "internal.company.com"
  ],
  last_updated: "2025-12-02T10:30:00Z"
}
```

#### F2: 快速切换当前页面
**描述**: 在popup中一键禁用/启用当前页面的高亮

**具体需求**:
- 显示当前页面的域名
- 显示当前页面是否被排除
- 一键添加/删除当前域名到排除列表
- 添加后立即生效(需要刷新页面)

**UI显示**:
```
┌─────────────────────────────┐
│ Current Page Controls       │
├─────────────────────────────┤
│ 🌐 Domain: github.com       │
│ Status: ✓ Enabled           │
│ [Disable This Site]         │
│                             │
│ Or use the form below:       │
├─────────────────────────────┤
```

#### F3: 预设排除列表
**描述**: 内置推荐的排除域名,新用户可选启用

**预设列表**:
- `localhost:*` (所有本地服务)
- `127.0.0.1:*` (本地IP)
- `file://` (本地文件)
- 用户自定义服务域名

#### F4: 内容脚本检查
**描述**: 在content script加载前检查是否应该禁用

**具体需求**:
- 加载前检查当前域名是否在黑名单
- 如果在黑名单,不注入高亮样式和脚本
- 如果不在黑名单,正常加载

---

#### F5: 预设排除列表 (推荐)

**描述**: 新用户首次使用时,推荐排除某些不适合高亮的网站

**预设列表内容**:

```javascript
const PRESET_EXCLUSIONS = {
  // 本地开发环境 (最常用)
  "localhost:8002",     // MixRead库页面
  "127.0.0.1:8000",     // 本地后端API
  "localhost:3000",     // React/Vue开发服务器
  "localhost:5173",     // Vite开发服务器

  // 生产工具
  "jenkins.company.com",
  "gitlab.company.com",
  "jira.company.com",

  // 文件协议
  "file://",

  // 邮件和通讯 (可选)
  "mail.google.com",
  "outlook.office.com",
};
```

**实现方式**:

1. **首次使用**
   - 检测是否为首次使用 (`first_time_setup` flag)
   - 显示对话框提示导入预设
   - 用户可选择接受或跳过

2. **对话框UI**
   ```
   ┌─────────────────────────────────────┐
   │ Welcome to MixRead!                 │
   ├─────────────────────────────────────┤
   │                                     │
   │ Do you want to exclude these sites  │
   │ from highlighting?                  │
   │                                     │
   │ ☑ localhost:8002 (Library page)     │
   │ ☑ localhost:3000 (Dev server)       │
   │ ☑ 127.0.0.1:8000 (Local API)       │
   │ ☑ file://                           │
   │ ☐ jenkins.company.com              │
   │ ☐ gitlab.company.com               │
   │                                     │
   │ [✓ Apply]  [× Skip]                │
   │                                     │
   └─────────────────────────────────────┘
   ```

3. **检查标记**
   ```javascript
   // localStorage
   {
     "first_time_setup": false,
     "setup_completed_at": "2025-12-02T10:30:00Z"
   }
   ```

**用户体验**:
```
新用户首次打开Popup
        ↓
弹出预设建议对话框
        ↓
用户可以选择要排除的网站 ☑
        ↓
点击 [✓ Apply]
        ↓
预设列表加入排除列表
        ↓
用户看到Popup中多了这些网站 ✓
```

---

### 2.2 技术需求

#### T1: 存储方案
**使用**: `chrome.storage.sync` (同步跨设备) ← **云端同步**

**特点**:
- ✅ 自动在用户登录的所有设备间同步
- ✅ 用户换设备时配置自动跟随
- ✅ Chrome 官方同步机制,安全可靠
- ✅ 离线时本地缓存,恢复时自动同步

**云端同步流程**:
```
设备A (配置黑名单)
    ↓
chrome.storage.sync 自动上传到 Google 云
    ↓
用户登录设备B
    ↓
自动下载配置到设备B
    ↓
设备B 立即拥有相同的黑名单 ✓
```

**结构**:
```javascript
// 使用 chrome.storage.sync 实现云端同步
chrome.storage.sync.get(['mixread_excluded_domains'], (result) => {
  const excluded = result.mixread_excluded_domains || [];
  // 检查当前URL是否在黑名单
});

// 更新黑名单时也自动同步
chrome.storage.sync.set({
  mixread_excluded_domains: updatedList,
  exclusion_updated_at: new Date().toISOString()
});
```

**同步细节**:
- 同步大小限制: 100KB (足以存储数千个域名)
- 同步延迟: 通常 < 1 秒
- 冲突处理: 最后修改时间决定(last-write-wins)
- 需要用户登录 Chrome 账户才能启用同步

#### T2: 域名匹配逻辑
**需要处理**:
- 精确匹配: `github.com` 匹配 `github.com` 但不匹配 `api.github.com`
- 通配符匹配: `localhost:*` 匹配 `localhost:8000`, `localhost:8001` 等
- 路径忽略: `example.com/path` → 只看 `example.com`
- HTTPS/HTTP: `https://example.com` 和 `http://example.com` 视为同一域名

**匹配函数**:
```javascript
function shouldExcludeDomain(currentUrl, excludedDomains) {
  const url = new URL(currentUrl);
  const currentDomain = url.hostname;
  const currentPort = url.port;
  const currentHost = url.hostname + (url.port ? ':' + url.port : '');

  for (let excluded of excludedDomains) {
    // 精确匹配
    if (excluded === currentDomain || excluded === currentHost) {
      return true;
    }
    // 通配符匹配 (localhost:*)
    if (excluded.includes('*')) {
      const pattern = excluded.replace('*', '.*');
      if (new RegExp('^' + pattern + '$').test(currentHost)) {
        return true;
      }
    }
  }
  return false;
}
```

#### T3: Manifest权限
**需要添加**:
```json
{
  "permissions": [
    "storage",
    "activeTab"
  ]
}
```

---

## 3. UI/UX 设计

### 3.1 Popup 页面布局

```
┌────────────────────────────────────────────┐
│                 MixRead                    │
├────────────────────────────────────────────┤
│                                            │
│ 👤 User: user_1764608846468_fe2v088uq     │
│ 📈 Today: 5 words added                    │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│ 🌐 Current Page: github.com                │
│ ✓ Status: Enabled                          │
│ [🚫 Disable This Site]                     │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│ Add Domain to Exclude List:                │
│ ┌──────────────────────────────────────┐   │
│ │ localhost:8002                       │   │
│ └──────────────────────────────────────┘   │
│ [Add Domain]                               │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│ Excluded Domains (3):                      │
│ • localhost:8002 [×]                       │
│ • 127.0.0.1:8000 [×]                       │
│ • localhost:3000 [×]                       │
│                                            │
│ [Import] [Export]                          │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│ 📋 [Batch Mark]  📚 [Go to Library]        │
│                                            │
└────────────────────────────────────────────┘
```

### 3.2 设置页面 (可选,Phase 2)

如果未来需要更复杂的设置,可以创建独立的设置页面:
```
chrome-extension://xxxxx/popup.html?tab=settings
```

包含:
- 排除列表编辑
- 预设列表选择
- 导入/导出
- 高级选项

---

## 4. 实现方案

### 4.1 代码结构

#### 新增文件
```
frontend/
├── modules/
│   └── exclusion/
│       ├── exclusion-store.js       # 排除列表管理
│       ├── exclusion-filter.js      # 域名匹配逻辑
│       └── exclusion-ui.js          # UI交互
├── popup.html                        # 更新,添加排除列表UI
├── popup.js                          # 更新,添加排除逻辑
└── content.js                        # 更新,检查排除列表
```

#### exclusion-store.js
```javascript
class ExclusionStore {
  // 获取排除列表
  async getExcludedDomains() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['mixread_excluded_domains'], (result) => {
        resolve(result.mixread_excluded_domains || []);
      });
    });
  }

  // 添加域名
  async addDomain(domain) {
    const excluded = await this.getExcludedDomains();
    if (!excluded.includes(domain)) {
      excluded.push(domain);
      return this.saveDomains(excluded);
    }
  }

  // 删除域名
  async removeDomain(domain) {
    const excluded = await this.getExcludedDomains();
    const filtered = excluded.filter(d => d !== domain);
    return this.saveDomains(filtered);
  }

  // 保存列表
  async saveDomains(domains) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        mixread_excluded_domains: domains,
        exclusion_updated_at: new Date().toISOString()
      }, resolve);
    });
  }

  // 检查是否被排除
  async isDomainExcluded(url) {
    const excluded = await this.getExcludedDomains();
    return this.matchesDomain(url, excluded);
  }

  // 域名匹配
  matchesDomain(url, excludedDomains) {
    const urlObj = new URL(url);
    const currentHost = urlObj.hostname + (urlObj.port ? ':' + urlObj.port : '');

    for (let excluded of excludedDomains) {
      if (excluded === urlObj.hostname || excluded === currentHost) {
        return true;
      }
      // 通配符支持
      if (excluded.includes('*')) {
        const pattern = escaped(excluded).replace('\\*', '.*');
        if (new RegExp('^' + pattern + '$').test(currentHost)) {
          return true;
        }
      }
    }
    return false;
  }
}
```

#### content.js 修改
```javascript
// 在脚本最顶部添加检查
(async function() {
  const exclusionStore = new ExclusionStore();
  const isExcluded = await exclusionStore.isDomainExcluded(window.location.href);

  if (isExcluded) {
    console.log('[MixRead] This domain is excluded, plugin disabled');
    return; // 退出,不加载任何高亮逻辑
  }

  // 继续原有的初始化...
  initializeModules();
})();
```

#### popup.js 修改
```javascript
// 添加UI事件处理
document.addEventListener('DOMContentLoaded', async () => {
  const exclusionStore = new ExclusionStore();

  // 显示当前页面状态
  const currentUrl = (await getCurrentTab()).url;
  const isExcluded = await exclusionStore.isDomainExcluded(currentUrl);

  updateCurrentPageStatus(currentUrl, isExcluded);

  // 绑定事件
  document.getElementById('btn-disable-site').addEventListener('click', () => {
    addCurrentDomainToExcluded();
  });

  // 显示排除列表
  await displayExcludedDomains();
});
```

---

## 5. 用户流程

### 5.1 首次使用
```
用户打开插件
  ↓
看到 "Current Page" 部分显示当前域名
  ↓
选择是否禁用该网站
  ↓
添加到排除列表
  ↓
重新加载页面 → 插件不再高亮该网站
```

### 5.2 管理排除列表
```
用户在Popup中看到排除列表
  ↓
点击某个域名旁的 [×]
  ↓
该域名被移除
  ↓
该网站恢复高亮(需要刷新)
```

### 5.3 导入/导出
```
用户点击 [Export]
  ↓
下载 mixread-exclusions.json
  ↓
json包含: {"excluded_domains": [...], "exported_at": "..."}

用户点击 [Import]
  ↓
选择之前导出的JSON文件
  ↓
合并或替换现有列表
```

---

## 6. 交互细节

### 6.1 当前页面禁用按钮

**状态1: 网站启用**
```
🌐 Domain: localhost:8002
✓ Status: Enabled
[🚫 Disable This Site]
```

**状态2: 网站禁用**
```
🌐 Domain: localhost:8002
✗ Status: Disabled
[✓ Enable This Site]
```

### 6.2 排除列表显示

**空列表**:
```
Excluded Domains (0):
No excluded domains yet.
[Add your first exclusion above]
```

**有项目**:
```
Excluded Domains (3):
┌─────────────────────────────┐
│ • localhost:8002      [×]   │
│ • 127.0.0.1:8000      [×]   │
│ • api.example.com     [×]   │
└─────────────────────────────┘
[Clear All] [Import] [Export]
```

### 6.3 域名输入验证

**验证规则**:
- ✅ `github.com`
- ✅ `localhost:8002`
- ✅ `127.0.0.1:3000`
- ✅ `localhost:*` (通配符)
- ❌ `http://github.com` (不需要协议)
- ❌ `github.com/path` (不需要路径)
- ❌ `` (空字符串)

**验证函数**:
```javascript
function validateDomain(input) {
  // 移除协议
  input = input.replace(/^https?:\/\//, '').split('/')[0];

  // 检查是否为空
  if (!input) return { valid: false, error: 'Domain cannot be empty' };

  // 检查是否包含有效字符
  if (!/^[a-zA-Z0-9._:-*]+$/.test(input)) {
    return { valid: false, error: 'Invalid domain format' };
  }

  return { valid: true, domain: input };
}
```

---

## 7. 数据安全和隐私

### 7.1 存储位置
- **使用**: `chrome.storage.local`
- **隐私**: 完全本地,不上传到任何服务器
- **权限**: 用户完全控制

### 7.2 数据结构
```javascript
{
  "mixread_excluded_domains": [
    "localhost:8002",
    "127.0.0.1:8000"
  ],
  "exclusion_updated_at": "2025-12-02T10:30:00Z"
}
```

### 7.3 导出格式
```json
{
  "version": "1.0",
  "exported_at": "2025-12-02T10:30:00Z",
  "excluded_domains": [
    "localhost:8002",
    "127.0.0.1:8000",
    "internal.company.com"
  ],
  "notes": "MixRead exclusion list backup"
}
```

---

## 8. 验收标准

### 8.1 功能验收
- [ ] 用户可以添加域名到排除列表
- [ ] 用户可以从排除列表删除域名
- [ ] 排除的域名在重新加载页面后插件不高亮
- [ ] 当前页面一键禁用/启用功能正常工作
- [ ] 排除列表在popup中正确显示
- [ ] 导入/导出功能正常工作
- [ ] 通配符 `*` 能正确匹配

### 8.2 用户体验验收
- [ ] 排除列表UI清晰易用
- [ ] 添加域名有验证和错误提示
- [ ] 页面刷新后排除立即生效
- [ ] 排除状态在popup中清晰可见

### 8.3 技术验收
- [ ] 没有JavaScript错误
- [ ] 不影响已有的高亮功能
- [ ] 性能无影响(域名检查 <10ms)
- [ ] 支持所有常见URL格式

---

## 9. 预设排除列表 (可选)

### 9.1 初始化预设
新用户首次使用时,可选择预设模板:

**预设1: 本地开发**
```
localhost:*
127.0.0.1:*
file://
```

**预设2: 工作环境**
```
localhost:*
127.0.0.1:*
file://
internal.company.com
jira.company.com
```

**预设3: 自定义**
用户手动添加

### 9.2 实现方式
```javascript
const PRESET_EXCLUSIONS = {
  local_dev: ['localhost:*', '127.0.0.1:*', 'file://'],
  work: ['localhost:*', '127.0.0.1:*', 'file://', 'internal.company.com'],
  custom: []
};
```

---

## 10. 未来扩展 (Phase 2+)

### 10.1 黑名单 → 白名单模式
允许用户选择:
- **黑名单模式** (当前): 排除指定域名
- **白名单模式**: 只在指定域名启用

### 10.2 规则引擎
```
支持更复杂的规则:
- 按URL路径排除 (*.localhost/admin/*)
- 按时间排除 (工作时间禁用某些网站)
- 按内容类型排除 (禁用论坛、邮件等)
```

### 10.3 同步到云端
```
与google账户同步排除列表:
- 跨设备同步
- 备份和恢复
- 版本历史
```

### 10.4 浏览器历史集成
```
从浏览历史提示可能要排除的网站:
"你经常访问 localhost:8002, 要排除吗?"
```

---

## 11. 实现时间表

**Phase 1 MVP** (当前)
- Week 1: 实现ExclusionStore和ExclusionFilter
- Week 2: 更新Popup UI和交互 (包括预设列表建议对话框)
- Week 3: 集成到content.js、预设初始化和测试

**Phase 2** (下一个迭代)
- 导入/导出功能
- 预设模板自定义
- UI优化和微调

**Phase 3+** (后续)
- 白名单模式
- 规则引擎
- 云端同步

---

## 12. 参考资源

- Chrome Storage API: https://developer.chrome.com/docs/extensions/reference/storage/
- URL API: https://developer.mozilla.org/en-US/docs/Web/API/URL
- Manifest V3: https://developer.chrome.com/docs/extensions/mv3/

---

## 附录: 常见问题

**Q: 排除列表如何影响性能?**
A: 每次加载页面检查一次(O(n)复杂度,n很小),<10ms,无感知。

**Q: 如何处理子域名?**
A: 精确匹配。`github.com` 不匹配 `api.github.com`。用户可用通配符。

**Q: 排除后如何恢复?**
A: Popup中点击[×]删除,或[Import]恢复备份。

**Q: 支持多个端口吗?**
A: 支持。`localhost:8000` 和 `localhost:8001` 视为不同域名。

---

**文档版本**: 1.0
**最后更新**: 2025-12-02
**状态**: 待开发

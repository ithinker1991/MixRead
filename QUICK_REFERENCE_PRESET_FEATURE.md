# 预设排除列表功能 - 快速参考

**文件位置**: `/Users/yinshucheng/code/creo/MixRead/`

---

## 📄 文档清单

| 文档 | 用途 | 行数 | 大小 |
|-----|------|------|------|
| `PRD_EXCLUDE_DOMAINS_FEATURE.md` | 完整PRD(12个Section) | 699 | 18KB |
| `FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md` | 执行摘要(8个Section) | 428 | 8.8KB |
| `DOMAIN_EXCLUSION_PRD_COMPLETE.md` | 完成总结和实现指南 | - | 12KB |

---

## 🎯 预设列表 (9个域名)

```javascript
const PRESET_EXCLUSIONS = {
  // 本地开发 (最常用)
  "localhost:8002",     // MixRead库页面 ← 解决用户问题
  "localhost:3000",     // React/Vue开发服务器
  "127.0.0.1:8000",     // 本地后端API
  "localhost:5173",     // Vite开发服务器

  // 生产工具
  "jenkins.company.com",
  "gitlab.company.com",
  "jira.company.com",

  // 通用
  "file://",            // 本地文件
  "mail.google.com"     // Gmail (可选)
};
```

---

## ☁️ 云端同步特性

**使用 `chrome.storage.sync` 自动同步配置**:

```
设备A (配置黑名单)
    ↓
Chrome 账户登录状态
    ↓
自动上传到 Google 云
    ↓
设备B 登录同一账户
    ↓
自动下载配置 ✓
```

**用户价值**:
- ✅ 换设备时配置自动跟随
- ✅ 无需手动导入/导出
- ✅ 多设备自动同步
- ✅ 离线时本地缓存
- ✅ 数据 Google 云加密存储

**技术细节**:
- 同步限制: 100KB (足够存储数千个域名)
- 延迟: 通常 <1 秒
- 冲突处理: last-write-wins
- 前提: 用户登录 Chrome 账户

---

## 🔄 首次使用流程

```
新用户打开Popup
    ↓
检查 first_time_setup 标志
    ↓
显示 "Welcome to MixRead!" 对话框
    ↓
用户选择要排除的网站 (可勾选/取消勾选)
    ↓
点击 [✓ Apply Presets]
    ↓
预设添加到排除列表
    ↓
设置 first_time_setup = false
    ↓
显示正常 Popup ✓
    ↓
下次打开不再显示对话框
```

---

## 📅 实现计划 (Phase 1)

### Week 1: 核心基础
- [ ] 创建 `frontend/modules/exclusion/exclusion-store.js`
  - [ ] getExcludedDomains()
  - [ ] addDomain(domain)
  - [ ] removeDomain(domain)
  - [ ] isDomainExcluded(url)

- [ ] 创建 `frontend/modules/exclusion/exclusion-filter.js`
  - [ ] shouldExcludeDomain(url, list)
  - [ ] 支持精确匹配、通配符、IP地址

### Week 2: UI + 预设对话框
- [ ] 更新 `popup.html` 添加排除列表UI
- [ ] 更新 `popup.js` 添加交互逻辑
- [ ] 实现预设建议对话框
  - [ ] 首次检测逻辑
  - [ ] 对话框UI渲染
  - [ ] 用户选择处理

### Week 3: 集成 + 测试
- [ ] 更新 `content.js` 加载时检查
- [ ] 实现预设初始化逻辑
- [ ] 完整功能测试
- [ ] 性能测试 (<10ms)
- [ ] 边界情况测试

---

## 🧪 关键测试场景

### 场景1: 首次使用预设
```
✓ 清空localStorage和chrome.storage.local
✓ 打开Popup显示预设对话框
✓ 默认4项被勾选 (localhost系列)
✓ 点击Apply后添加到排除列表
✓ 下次打开不再显示对话框
```

### 场景2: 预设生效验证
```
✓ 访问localhost:8002无高亮
✓ 访问github.com正常高亮
✓ 访问localhost:3000无高亮
```

### 场景3: 用户修改预设
```
✓ 删除localhost:3000从排除列表
✓ 重新访问localhost:3000有高亮
✓ 其他预设仍然有效
```

---

## 🎨 UI 设计参考

### 预设建议对话框

```
┌─────────────────────────────────────┐
│  Welcome to MixRead! 👋              │
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
│ ☐ jira.company.com                 │
│                                     │
│ [✓ Apply]  [× Skip]                │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔧 核心代码逻辑

### 域名匹配 (exclusion-filter.js)

```javascript
function shouldExcludeDomain(currentUrl, excludedDomains) {
  const url = new URL(currentUrl);
  const currentHost = url.hostname + (url.port ? ':' + url.port : '');

  for (let excluded of excludedDomains) {
    // 精确匹配
    if (excluded === url.hostname || excluded === currentHost) return true;

    // 通配符: localhost:*
    if (excluded.includes('*')) {
      const pattern = excluded.replace(/\*/g, '.*');
      if (new RegExp('^' + pattern + '$').test(currentHost)) return true;
    }

    // 文件协议
    if (excluded === 'file://' && url.protocol === 'file:') return true;
  }
  return false;
}
```

### 预设初始化 (popup.js)

```javascript
async function initializePresets() {
  const isFirstTime = !localStorage.getItem('mixread_first_time_setup');

  if (isFirstTime) {
    const selected = await showPresetDialog(PRESET_EXCLUSIONS);
    const current = await exclusionStore.getExcludedDomains();
    const merged = [...new Set([...current, ...selected])];

    await exclusionStore.saveDomains(merged);
    localStorage.setItem('mixread_first_time_setup', true);
  }
}
```

---

## 📊 性能目标

- **域名检查时间**: <10ms (即使列表很大)
- **对话框显示时间**: <100ms (一次性)
- **存储空间**: ~2KB
- **网络开销**: 0 (全本地)

---

## 🎓 相关文档

详细内容请参考:
- **技术细节**: `DOMAIN_EXCLUSION_PRD_COMPLETE.md`
- **完整需求**: `PRD_EXCLUDE_DOMAINS_FEATURE.md`
- **快速概览**: `FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md`

---

## ✅ 验收标准

### 功能验收
- [ ] 新用户首次打开Popup显示预设对话框
- [ ] 用户可以选择要应用的预设
- [ ] 点击Apply后预设被添加到排除列表
- [ ] 预设生效(排除的网站无高亮)
- [ ] 下次打开不再显示对话框
- [ ] 用户可随时删除任何预设

### 性能验收
- [ ] 域名检查时间 <10ms
- [ ] 对话框加载时间 <100ms
- [ ] 无内存泄漏

### UX验收
- [ ] 对话框清晰易用
- [ ] 每个预设有明确说明
- [ ] 用户可轻松自定义选择

---

## 🚀 开发快速开始

1. **从 exclusion-store.js 开始**
   - 实现基础的数据存储和查询
   - 参考 PRD 中的代码示例

2. **然后做 exclusion-filter.js**
   - 实现域名匹配逻辑
   - 支持精确、通配符、IP、file://

3. **再做 Popup UI**
   - 添加排除列表显示
   - 添加输入框和删除按钮

4. **最后做预设和集成**
   - 实现预设建议对话框
   - 集成到 content.js
   - 边做边测试

---

**文档版本**: 1.0
**更新时间**: 2025-12-02
**状态**: ✅ 准备开发

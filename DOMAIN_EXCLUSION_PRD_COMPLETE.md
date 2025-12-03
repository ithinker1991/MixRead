# 域名排除功能 PRD - 完成文档

**完成时间**: 2025-12-02
**状态**: ✅ 全部完成,准备开发

---

## 📋 任务概述

根据用户需求"默认就有一些网站,可以不启动"(By default some websites should not activate),完成了域名排除功能的完整PRD文档,包括**预设排除列表**功能。

### 用户背景
- 用户在 `localhost:8002/library-viewer.html` 上发现MixRead插件的高亮显示导致页面混乱
- 需要能够为特定网站禁用插件高亮功能
- 希望有默认的排除列表,方便新用户使用

---

## ✅ 完成内容

### 文档输出

#### 1. **PRD_EXCLUDE_DOMAINS_FEATURE.md** (699行)
完整的产品需求文档,包括:

**结构内容**:
- 概述 (问题陈述 + 解决方案)
- 功能需求 (F1-F5共5个核心功能)
- 技术需求 (存储、匹配逻辑、权限)
- UI/UX设计 (Popup布局、交互细节)
- 实现方案 (代码结构、具体实现示例)
- 用户流程 (首次使用、管理列表、导入/导出)
- 交互细节 (按钮状态、表单验证)
- 数据安全和隐私
- 验收标准
- **预设排除列表 (F5)** - 新增详细规范
- 未来扩展计划 (Phase 2+)
- 实现时间表
- 参考资源
- 常见问题

**核心功能**:
- ✅ F1: 排除域名列表管理
- ✅ F2: 快速切换当前页面
- ✅ F3: 预设排除列表 (用户故事中提到)
- ✅ F4: 内容脚本检查
- ✅ **F5: 预设排除列表 (推荐)** ← 新增详细规范

#### 2. **FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md** (428行)
执行摘要文档,包括:

**结构内容**:
- 快速概览 (问题、解决方案、核心功能)
- 一图胜千言 (用户界面流程、数据流)
- 功能详细说明 (排除列表管理、当前页面控制、**预设列表、域名匹配规则**)
- 实现概览 (模块结构、存储格式)
- **用户故事4: 首次使用预设建议** ← 新增
- 技术亮点
- 预期收益
- 实现步骤 (Phase 1-3)
- 测试场景
- 风险和缓解
- 完整PRD参考

---

## 🎯 预设排除列表功能详解

### 设计目标
- **新用户0配置**:自动建议排除常见的开发工具和本地服务
- **用户自主选择**:新用户可以自定义启用/禁用哪些预设
- **一次性设置**:首次使用时显示,之后不再打扰
- **后续可自定义**:用户可以随时修改排除列表

### 预设包含的域名 (9个)

```javascript
const PRESET_EXCLUSIONS = {
  // 本地开发环境 (最常用)
  "localhost:8002",     // MixRead库页面 ← 直接解决用户问题
  "127.0.0.1:8000",     // 本地后端API
  "localhost:3000",     // React/Vue开发服务器
  "localhost:5173",     // Vite开发服务器

  // 生产工具
  "jenkins.company.com",
  "gitlab.company.com",
  "jira.company.com",

  // 通用
  "file://",            // 本地文件

  // 通讯 (可选)
  "mail.google.com"
};
```

### 首次使用流程

```
1️⃣ 首次安装 + 打开Popup
   ↓
2️⃣ 检测 first_time_setup 标志
   ↓
3️⃣ 显示 "Welcome to MixRead!" 对话框
   ├─ localhost:8002 (Library page)       ☑ 默认勾选
   ├─ localhost:3000 (Dev server)         ☑ 默认勾选
   ├─ 127.0.0.1:8000 (Local API)         ☑ 默认勾选
   ├─ file://                              ☑ 默认勾选
   ├─ jenkins.company.com                 ☐ 取消勾选
   ├─ gitlab.company.com                  ☐ 取消勾选
   └─ [✓ Apply]  [× Skip]
   ↓
4️⃣ 用户勾选需要的预设
   ↓
5️⃣ 点击 [✓ Apply]
   ↓
6️⃣ 预设列表添加到排除列表
   ↓
7️⃣ 设置 first_time_setup = false
   ↓
8️⃣ 显示正常 Popup 界面
   ↓
9️⃣ 下次打开 Popup 时无对话框 ✓
```

### 存储结构

```javascript
// First-time setup flag
localStorage.setItem('mixread_first_time_setup', false);
localStorage.setItem('mixread_setup_completed_at', '2025-12-02T10:30:00Z');

// Excluded domains in chrome.storage.local
{
  "mixread_excluded_domains": [
    "localhost:8002",      // 用户选择的预设
    "localhost:3000",
    "127.0.0.1:8000",
    "file://",
    // 用户后来手动添加的...
    "example.com"
  ],
  "exclusion_updated_at": "2025-12-02T10:30:00Z"
}
```

---

## 📊 实现计划更新

### Phase 1 MVP (当前迭代)
**周期**: 3周

```
Week 1: 核心基础
├─ 创建 exclusion-store.js
│  └─ 数据存储 CRUD、查询接口
├─ 创建 exclusion-filter.js
│  └─ 域名匹配逻辑 (精确、通配符)
└─ 基础测试

Week 2: Popup UI + 预设对话框
├─ 更新 popup.html 添加排除列表UI
├─ 更新 popup.js 添加交互逻辑
├─ 实现预设建议对话框
│  ├─ 首次检测逻辑
│  ├─ 对话框UI渲染
│  └─ 用户选择处理
└─ UI/UX 测试

Week 3: 集成 + 预设初始化 + 测试
├─ 更新 content.js 加载时检查
├─ 实现预设初始化逻辑
├─ 集成预设到排除列表
├─ 完整功能测试
├─ 性能测试 (<10ms)
└─ 边界情况测试
```

### Phase 2 (下一迭代)
- 导入/导出功能 (JSON格式)
- 预设列表自定义编辑
- UI微调和优化
- 文档完善

### Phase 3+
- 白名单模式 (反向逻辑)
- 规则引擎 (更复杂的匹配)
- 云端同步 (跨设备)

---

## 🧪 测试场景

### 场景1: 首次使用预设
```
1. 清空 localStorage 和 chrome.storage.local
2. 刷新扩展
3. 打开 Popup
4. ✅ 应显示预设建议对话框
5. ✅ 默认4项被勾选 (localhost:8002, localhost:3000, 等)
6. 取消勾选 jenkins.company.com
7. 点击 [✓ Apply]
8. ✅ 检查 mixread_excluded_domains 包含选中项
9. ✅ 检查 first_time_setup = false
10. 刷新 Popup
11. ✅ 对话框不再显示
```

### 场景2: 预设生效验证
```
1. 访问 localhost:8002/library-viewer.html
2. 打开 DevTools
3. ✅ 不应该看到 [MixRead] 初始化日志
4. ✅ 页面无高亮效果
5. 访问其他网站 (如 github.com)
6. ✅ 应该看到正常高亮
```

### 场景3: 用户修改预设
```
1. 新用户应用了预设
2. 后来决定在 localhost:3000 启用高亮
3. 在排除列表中找到 localhost:3000
4. 点击 [×] 删除
5. ✅ localhost:3000 从排除列表移除
6. 访问 localhost:3000
7. ✅ 应显示高亮
```

---

## 🎨 UI/UX 细节

### 预设建议对话框

```
┌────────────────────────────────────┐
│  Welcome to MixRead! 👋             │
├────────────────────────────────────┤
│                                    │
│ Do you want to exclude these sites │
│ from highlighting?                 │
│                                    │
│ Local Development:                 │
│ ☑ localhost:8002 (Library page)    │
│ ☑ localhost:3000 (Dev server)      │
│ ☑ 127.0.0.1:8000 (Local API)      │
│ ☑ file://                          │
│                                    │
│ Tools:                             │
│ ☐ jenkins.company.com (CI/CD)     │
│ ☐ gitlab.company.com (VCS)        │
│ ☐ jira.company.com (Issues)       │
│                                    │
│ [✓ Apply Presets]  [× Skip]       │
│                                    │
└────────────────────────────────────┘
```

### 正常 Popup 界面 (预设已应用)

```
┌──────────────────────────────────────────┐
│              MixRead                     │
├──────────────────────────────────────────┤
│                                          │
│ 👤 User: user_1764608846468_fe2v088uq   │
│ 📈 Today: 5 words added                  │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│ 🌐 Current Page: github.com              │
│ ✓ Status: Enabled                        │
│ [Disable This Site]                      │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│ Excluded Domains (7):                    │
│ • localhost:8002 (preset) [×]           │
│ • localhost:3000 (preset) [×]           │
│ • 127.0.0.1:8000 (preset) [×]          │
│ • file:// (preset) [×]                  │
│ • example.com [×]                        │
│ • internal-wiki.company.com [×]         │
│ • staging.app.com [×]                   │
│                                          │
│ [Import] [Export]                       │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🔧 技术关键点

### 域名匹配逻辑

```javascript
function shouldExcludeDomain(currentUrl, excludedDomains) {
  const url = new URL(currentUrl);
  const currentHost = url.hostname + (url.port ? ':' + url.port : '');

  for (let excluded of excludedDomains) {
    // 1. 精确匹配域名
    if (excluded === url.hostname) return true;
    
    // 2. 精确匹配 host:port
    if (excluded === currentHost) return true;
    
    // 3. 通配符匹配 (e.g., localhost:*)
    if (excluded.includes('*')) {
      const pattern = excluded
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // escape special chars
        .replace(/\\\*/g, '.*');                  // convert * to .*
      if (new RegExp('^' + pattern + '$').test(currentHost)) return true;
    }
    
    // 4. 文件协议
    if (excluded === 'file://' && url.protocol === 'file:') return true;
  }
  return false;
}
```

### 预设初始化逻辑

```javascript
async function initializePresets() {
  const isFirstTime = !localStorage.getItem('mixread_first_time_setup');
  
  if (isFirstTime) {
    // 显示预设建议对话框
    const selected = await showPresetDialog(PRESET_EXCLUSIONS);
    
    // 添加选中的预设到排除列表
    const currentExcluded = await exclusionStore.getExcludedDomains();
    const merged = [...new Set([...currentExcluded, ...selected])];
    
    await exclusionStore.saveDomains(merged);
    
    // 标记首次设置完成
    localStorage.setItem('mixread_first_time_setup', true);
    localStorage.setItem('mixread_setup_completed_at', 
      new Date().toISOString());
  }
}
```

---

## 📈 性能指标

- **域名检查时间**: <10ms (即使排除列表很大)
- **对话框显示时间**: <100ms (一次性,不影响后续)
- **存储空间**: ~2KB (排除列表 JSON)
- **网络开销**: 0 (全部本地操作)

---

## ✨ 用户价值

### 解决的问题
1. ✅ **localhost:8002 库页面混乱** - 通过预设自动排除
2. ✅ **新用户配置麻烦** - 预设建议一键应用
3. ✅ **常见本地服务重复配置** - 预设覆盖大部分场景
4. ✅ **开发者工具不需要高亮** - Jenkins、GitLab、Jira等预设

### 用户体验提升
- **0配置成本**: 新用户打开即可使用
- **高度可定制**: 用户可以选择启用/禁用任何预设
- **清晰的建议**: 每个预设都有明确的用途说明
- **专业的体验**: 一次性设置,后续无打扰

---

## 📚 文件清单

| 文件 | 行数 | 内容 |
|-----|------|------|
| PRD_EXCLUDE_DOMAINS_FEATURE.md | 699 | 完整PRD (12个部分) |
| FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md | 428 | 执行摘要 (8个部分) |
| 本文档 | - | 完成总结 |

---

## 🚀 后续步骤

### 立即可做
1. ✅ 根据PRD开始编码实现
2. ✅ 按照 Week 1-3 计划推进
3. ✅ 参考提供的代码示例

### 需要澄清
- 是否需要支持其他浏览器 (Firefox, Safari)?
- 导入/导出是否需要在 Phase 1 实现?
- 预设列表是否需要多语言支持?

---

**文档版本**: 1.0  
**创建日期**: 2025-12-02  
**状态**: ✅ 完成,准备开发  
**下一步**: 代码实现 (Week 1)


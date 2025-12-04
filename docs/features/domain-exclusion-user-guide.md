# Domain Blacklist User Guide (域名黑名单用户指南)

**Last Updated**: 2025-12-04
**Status**: ✅ Implemented - P1 Complete

---

## 功能概述

Domain Blacklist 功能允许用户在特定网站上禁用 MixRead 的单词高亮功能，减少干扰。

![Domain Blacklist UI](../image/domain-exclusion/1764843484281.png)

---

## 用户界面说明

### 1. 快速操作区域 (Quick Actions)

**位置**: Domains 标签页顶部，蓝色背景区域

**功能**:
- **Current Page**: 显示当前访问的页面域名
- **Exclude Domain**: 一键将当前域名加入黑名单（红色按钮）
- **Exclude Path**: 一键将当前域名+路径加入黑名单（橙色按钮）

**使用流程**:
1. 打开想要排除高亮的网页
2. 点击 MixRead 插件图标
3. 切换到 Domains 标签
4. 点击 "Exclude Domain" 按钮
5. 页面自动刷新，该网站将不再显示单词高亮

### 2. 添加域名区域

**功能**: 手动输入要排除的域名
- 输入框：支持域名格式（如 example.com）
- Add 按钮：将输入的域名添加到黑名单

### 3. 黑名单列表区域

**显示**: "Blacklist (数字)" - 显示当前黑名单中的域名数量

**默认内容**:
新用户首次登录时，自动获得以下 13 个预设域名：

- **开发环境**
  - localhost
  - 127.0.0.1

- **学习工具**
  - quizlet.com (闪卡平台)
  - anki.deskew.com (记忆卡工具)

- **社交媒体**
  - facebook.com
  - twitter.com
  - reddit.com
  - instagram.com
  - tiktok.com

- **视频平台**
  - youtube.com

- **隐私敏感**
  - mail.google.com (Gmail)
  - github.com
  - stackoverflow.com

### 4. 管理操作

- **删除**: 点击域名右侧的 "✕" 按钮删除（无需确认）
- **预设域名**: 点击 "Add Preset Domains" 可重新添加默认域名

---

## 工作原理

1. **自动检测**: 访问网页时，插件自动检查域名是否在黑名单中
2. **禁用高亮**: 如果域名在黑名单中，该页面不会显示任何单词高亮
3. **实时生效**: 添加/删除域名后，页面自动刷新，新设置立即生效

---

## 常见问题

### Q: 如何临时恢复某个网站的单词高亮？
A: 在黑名单列表中点击该域名右侧的 "✕" 删除按钮，页面会自动刷新并恢复高亮。

### Q: 支持哪些格式的域名？
A: 支持完整域名格式，如：
- `example.com`
- `subdomain.example.com`
- `localhost:8002` (包含端口号)
- `github.com/user/repo` (完整路径)

### Q: 删除的默认域名如何恢复？
A: 点击 "Add Preset Domains" 按钮，选择需要恢复的域名。

### Q: 每个用户的黑名单是独立的吗？
A: 是的，每个登录的用户都有独立的黑名单设置，互不影响。

---

## 数据持久化

- 黑名单数据保存在用户的账户中
- 即使在不同设备上登录，设置也会同步
- 数据保存在 MixRead 后端数据库中

---

## 开发者维护说明

### P1 已实现功能

1. ✅ **默认黑名单初始化**
   - 13 个预设域名自动导入
   - 新用户开箱即用

2. ✅ **快速操作 UI**
   - 一键排除当前页面域名
   - 无确认对话框，直接操作

3. ✅ **用户管理界面**
   - 查看/删除黑名单项
   - 手动添加自定义域名
   - 预设域名管理

### 技术实现

- **前端**: `frontend/popup.html`, `frontend/popup.js`
- **后端**: `backend/infrastructure/repositories.py`
- **API**: `/users/{user_id}/domain-policies/blacklist`

### 文件位置

```
Frontend:
├── popup.html (UI 结构)
├── popup.js (交互逻辑)
└── modules/domain-policy/
    ├── domain-policy-store.js (数据管理)
    └── domain-policy-filter.js (匹配逻辑)

Backend:
├── infrastructure/
│   ├── repositories.py (数据持久化)
│   └── models.py (数据模型)
└── api/routes.py (API 端点)

Documentation:
├── domain-exclusion.md (技术文档)
└── domain-exclusion-user-guide.md (本文档)
```

### 数据库表结构

```sql
domain_management_policies
- user_id (用户ID)
- domain (域名)
- policy_type (策略类型: blacklist/whitelist)
- is_active (是否启用)
- description (描述)
- added_at (添加时间)
```
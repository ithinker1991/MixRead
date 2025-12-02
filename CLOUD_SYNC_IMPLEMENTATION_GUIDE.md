# 云端同步实现指南

**特性**: 使用 Chrome 官方 API 实现跨设备配置自动同步

**创建时间**: 2025-12-02

---

## 📋 概述

用户在一台设备上配置的黑名单，会自动同步到其他登录同一 Chrome 账户的设备上。这样用户换设备时无需重新配置。

### 核心原理

```
User Chrome Account (登录状态)
    ↓
chrome.storage.sync API
    ↓
Google Cloud (加密存储)
    ↓
自动分发到所有已登录该账户的设备
```

---

## 🔧 技术实现

### 1. 存储 API 选择

**`chrome.storage.sync` vs `chrome.storage.local`**:

| 特性 | sync | local |
|------|------|-------|
| 跨设备同步 | ✅ 是 | ❌ 否 |
| 云端存储 | ✅ Google Cloud | ❌ 本地 |
| 同步延迟 | ~1秒 | 0ms |
| 大小限制 | 100KB | 10MB |
| 需要登录 | ✅ Chrome账户 | ❌ 否 |
| 离线支持 | ✅ 本地缓存 | ✅ 本地 |

**选择**: `chrome.storage.sync` ✅

---

## 💻 代码实现

### exclusion-store.js 修改

```javascript
class ExclusionStore {
  /**
   * 获取排除列表 (自动同步)
   * 如果多设备同时修改,Google Cloud 会保持最新版本
   */
  async getExcludedDomains() {
    return new Promise((resolve) => {
      // 使用 chrome.storage.sync 而不是 chrome.storage.local
      chrome.storage.sync.get(['mixread_excluded_domains'], (result) => {
        const excluded = result.mixread_excluded_domains || [];
        resolve(excluded);
      });
    });
  }

  /**
   * 添加域名 (自动同步)
   */
  async addDomain(domain) {
    const excluded = await this.getExcludedDomains();

    if (!excluded.includes(domain)) {
      excluded.push(domain);
      return this.saveDomains(excluded);
    }
  }

  /**
   * 删除域名 (自动同步)
   */
  async removeDomain(domain) {
    const excluded = await this.getExcludedDomains();
    const filtered = excluded.filter(d => d !== domain);
    return this.saveDomains(filtered);
  }

  /**
   * 保存列表 (触发同步)
   * chrome.storage.sync 会自动上传到 Google Cloud
   * 其他设备会自动下载更新
   */
  async saveDomains(domains) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({
        mixread_excluded_domains: domains,
        exclusion_updated_at: new Date().toISOString()
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save to sync storage:',
            chrome.runtime.lastError);
        } else {
          console.log('Excluded domains synced to Google Cloud');
        }
        resolve();
      });
    });
  }

  /**
   * 检查是否被排除
   */
  async isDomainExcluded(url) {
    const excluded = await this.getExcludedDomains();
    return this.matchesDomain(url, excluded);
  }

  /**
   * 域名匹配逻辑
   */
  matchesDomain(url, excludedDomains) {
    try {
      const urlObj = new URL(url);
      const currentHost = urlObj.hostname +
        (urlObj.port ? ':' + urlObj.port : '');

      for (let excluded of excludedDomains) {
        // 精确匹配
        if (excluded === urlObj.hostname ||
            excluded === currentHost) {
          return true;
        }

        // 通配符支持
        if (excluded.includes('*')) {
          const pattern = excluded
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '.*');
          if (new RegExp('^' + pattern + '$').test(currentHost)) {
            return true;
          }
        }
      }
      return false;
    } catch (e) {
      console.error('Domain matching error:', e);
      return false;
    }
  }

  /**
   * 监听同步变化 (多设备间同步)
   * 其他设备修改时,当前设备会自动收到通知
   */
  onSyncedDomainsChanged(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' &&
          'mixread_excluded_domains' in changes) {
        const newDomains = changes.mixread_excluded_domains.newValue;
        callback(newDomains);
      }
    });
  }
}
```

---

## 🔄 同步流程详解

### 场景1: 用户在设备A添加排除域名

```
用户在 Device A Popup 中输入: "example.com"
    ↓
点击 "Add Domain"
    ↓
exclusion-store.addDomain("example.com")
    ↓
chrome.storage.sync.set() 被调用
    ↓
Google Cloud 接收更新
    (加密存储 + 时间戳记录)
    ↓
Google Cloud 检查其他登录设备
    ↓
Device B/C/D 收到通知
    ↓
content.js 中的 onChanged 监听器触发
    ↓
下一次访问 example.com 时自动排除 ✓
```

### 场景2: 用户在设备B打开浏览器

```
Device B 启动 Chrome
    ↓
加载 MixRead 扩展
    ↓
content.js 执行
    ↓
ExclusionStore.getExcludedDomains()
    ↓
chrome.storage.sync.get()
    ↓
Google Cloud 返回最新列表
    ↓
本地列表更新为:
  • localhost:8002 (预设)
  • localhost:3000 (预设)
  • example.com (Device A 添加)
    ↓
打开任何网站都已使用最新配置 ✓
```

### 场景3: 离线修改 (本地缓存)

```
Device A 离线状态下
    ↓
用户添加排除域名: "staging.example.com"
    ↓
chrome.storage.sync.set()
    ↓
Chrome 本地缓存该修改
    ↓
当前会话中使用新配置
    ↓
恢复网络连接
    ↓
自动上传到 Google Cloud
    ↓
其他设备收到更新 ✓
```

---

## ⚙️ Manifest 权限配置

```json
{
  "manifest_version": 3,
  "name": "MixRead",

  "permissions": [
    "storage"  // 需要此权限使用 chrome.storage
  ],

  "host_permissions": [
    "<all_urls>"
  ]
}
```

注: `storage` 权限包含对 `chrome.storage.sync` 和 `chrome.storage.local` 的访问

---

## 🌐 用户数据隐私和安全

### Google Cloud 保护

- ✅ **端到端加密**: 数据在传输和存储中加密
- ✅ **与其他数据隔离**: 只有 Chrome 扩展可以访问
- ✅ **用户隐私**: Google 看不到你的黑名单内容
- ✅ **账户绑定**: 只有同一 Google 账户可以访问

### 用户控制

用户可以在 Chrome 设置中禁用同步:
- 打开 Chrome 设置
- 选择 "您和 Google"
- 关闭 "同步" 开关
- 所有扩展数据也会停止同步

---

## 🚀 实现步骤

### Week 1: 修改存储 API

1. **修改 `exclusion-store.js`**
   ```javascript
   // 替换所有 chrome.storage.local.get
   // 为 chrome.storage.sync.get

   // 替换所有 chrome.storage.local.set
   // 为 chrome.storage.sync.set
   ```

2. **添加同步变化监听**
   ```javascript
   // 在 initialization 中添加
   exclusionStore.onSyncedDomainsChanged((newDomains) => {
     // 如果需要,可以重新加载 UI
     // 但通常 content.js 每次都会调用 getExcludedDomains
   });
   ```

3. **测试单设备同步**
   - 添加/删除域名
   - 验证 chrome.storage.sync 正确存储
   - 检查 DevTools Network/Application 标签

### Week 2: 多设备测试

1. **在设备A配置**
   ```
   添加 3-5 个排除域名
   验证存储到 chrome.storage.sync
   ```

2. **在设备B验证**
   ```
   使用同一 Chrome 账户登录
   安装 MixRead
   验证所有配置自动出现
   ```

3. **修改冲突测试**
   ```
   Device A 和 Device B 同时修改
   验证最后修改的内容保留
   ```

### Week 3: 优化和文档

1. **错误处理**
   ```javascript
   // 处理 sync 不可用的情况
   // (例如用户未登录 Chrome)
   ```

2. **离线模式**
   ```javascript
   // 确保离线时使用本地缓存
   // 恢复网络时自动同步
   ```

3. **用户文档**
   - 解释云端同步如何工作
   - 说明隐私和安全
   - 如何禁用同步

---

## 📊 监控和调试

### 查看同步状态

```javascript
// 在 popup 中显示同步状态
chrome.storage.sync.getBytesInUse((bytesInUse) => {
  console.log('Using ' + bytesInUse + ' bytes of storage');
});

// 最大限制是 102400 字节 (100KB)
// 预留 20% 的空间比较安全
```

### Chrome DevTools

1. **Application → Storage**
   - 查看 `chrome.storage.sync` 的内容
   - 监控数据大小

2. **Console**
   - 手动调用 API 进行测试
   ```javascript
   chrome.storage.sync.get(null, console.log);  // 查看所有数据
   ```

---

## 🎯 性能考虑

### 同步延迟

| 操作 | 延迟 |
|------|------|
| 添加/删除域名 | <100ms (本地) |
| 上传到 Google Cloud | 100-500ms |
| 其他设备接收 | 1-3秒 |
| 完整同步 | <5秒 |

### 优化建议

1. **批量操作**
   ```javascript
   // 如果要添加多个域名,合并为单次操作
   async addMultipleDomains(domains) {
     const current = await this.getExcludedDomains();
     const merged = [...new Set([...current, ...domains])];
     return this.saveDomains(merged);
   }
   ```

2. **避免频繁更新**
   - 合并多个修改为单次 set 操作
   - 不要每次都更新 timestamp

---

## ✅ 测试清单

- [ ] 单设备同步工作正常
- [ ] 多设备间自动同步
- [ ] 离线修改后恢复网络自动同步
- [ ] 冲突处理(最后修改时间获胜)
- [ ] 用户未登录 Chrome 时的降级处理
- [ ] 存储大小不超过 100KB
- [ ] 同步通知正确触发
- [ ] 性能目标 <10ms 检查时间

---

## 📚 参考资源

- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [chrome.storage.sync](https://developer.chrome.com/docs/extensions/reference/storage/#property-sync)
- [Sync 行为和限制](https://developer.chrome.com/docs/extensions/reference/storage/#synchronization)

---

## 💡 将来改进 (Phase 2+)

- [ ] 可视化同步状态
- [ ] 手动触发同步
- [ ] 冲突解决UI
- [ ] 本地备份功能
- [ ] 导出为 JSON

---

**实现难度**: ⭐ (简单)
**开发时间**: 1-2 天
**收益**: 用户可跨设备使用,无需重新配置
**风险**: 低 (使用 Chrome 官方 API)


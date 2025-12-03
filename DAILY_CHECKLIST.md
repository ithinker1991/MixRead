# Domain Exclusion 功能 - 每日工作清单

**开发开始日期**: 2025-12-02
**预计完成**: 2025-12-23 (3 周)

---

## 📅 Week 1: 后端开发 (当前)

### ✅ Day 1 (今天): 数据库模型

**目标**: 创建 ExcludedDomainModel 和数据库表

```
早上任务:
  [ ] 打开 DEVELOPMENT_START_HERE.md
  [ ] 理解 Step 1 内容 (5 分钟)
  [ ] 打开 backend/infrastructure/models.py

中午任务:
  [ ] 复制 ExcludedDomainModel 代码
  [ ] 添加到 models.py
  [ ] 更新 UserModel 关系
  [ ] 保存文件

下午任务:
  [ ] 运行数据库迁移 (Alembic 或手动 SQL)
  [ ] 验证表是否创建 (sqlite3 或 MySQL CLI)
  [ ] 检查索引是否正确

验收标准:
  [ ] 表 excluded_domains 存在
  [ ] 字段: id, user_id, domain, added_at
  [ ] 索引 (user_id, domain) 存在且唯一
  [ ] 外键关系正确
```

**遇到问题?**
查看: `IMPLEMENTATION_PLAN_SIMPLIFIED.md` → `Week 1: 后端开发` → `Day 1: 数据库 + Repository + Service`

---

### ✅ Day 2: Repository + Service

**目标**: 实现数据访问层和业务逻辑层

```
早上任务:
  [ ] 打开 backend/infrastructure/repositories.py
  [ ] 复制 ExcludedDomainRepository 类
  [ ] 调整导入路径
  [ ] 保存文件

中午任务:
  [ ] 打开 backend/application/services.py
  [ ] 复制 ExclusionApplicationService 类
  [ ] 调整导入路径
  [ ] 保存文件

下午任务:
  [ ] 创建 backend/tests/test_exclusion.py
  [ ] 复制测试代码
  [ ] 运行测试: pytest tests/test_exclusion.py -v
  [ ] 所有测试通过

验收标准:
  [ ] Repository 有 5 个方法 (get_by_user, add_domain, remove_domain, clear_all)
  [ ] Service 有 4 个方法 (get_excluded_domains, add_domain, remove_domain, add_multiple_domains)
  [ ] pytest 输出: 5-7 个测试全部通过
  [ ] 无错误信息
```

**遇到问题?**
查看: `IMPLEMENTATION_PLAN_SIMPLIFIED.md` → `Week 1: 后端开发` → `Day 1: 后端数据库`

---

### ✅ Day 3: API Endpoints + 前端 Store

**目标**: 添加 4 个 API 端点，创建前端 Store 类

```
早上任务:
  [ ] 打开 backend/api/routes.py
  [ ] 添加请求模型 (AddDomainRequest, AddMultipleDomainsRequest)
  [ ] 添加 4 个 API endpoints:
      [ ] GET /{user_id}/excluded-domains
      [ ] POST /{user_id}/excluded-domains
      [ ] POST /{user_id}/excluded-domains/batch
      [ ] DELETE /{user_id}/excluded-domains/{domain}
  [ ] 保存文件

中午任务:
  [ ] 启动后端: python main.py
  [ ] 测试 API 端点:
      [ ] 获取排除列表
      [ ] 添加单个域名
      [ ] 批量添加域名
      [ ] 删除域名

下午任务:
  [ ] 创建 frontend/modules/exclusion/exclusion-store.js
  [ ] 复制完整的 ExclusionStore 类
  [ ] 创建 frontend/modules/exclusion/exclusion-filter.js
  [ ] 复制完整的 ExclusionFilter 类

验收标准:
  [ ] 4 个 API endpoints 都能正常工作
  [ ] curl 测试所有端点成功
  [ ] exclusion-store.js 包含 6 个方法
  [ ] exclusion-filter.js 包含 1 个方法
  [ ] 无 JavaScript 语法错误
```

**遇到问题?**
查看: `IMPLEMENTATION_PLAN_SIMPLIFIED.md` → `Week 1: 后端开发` → `Day 2-3 和 Week 2`

---

## 📅 Week 2: 前端开发

### ✅ Day 4-5: Popup UI

**目标**: 创建用户界面，实现管理功能

```
早上任务 (Day 4):
  [ ] 打开 IMPLEMENTATION_PLAN_SIMPLIFIED.md Week 2 部分
  [ ] 创建 frontend/popup.html
  [ ] 复制完整的 HTML 代码
  [ ] 复制完整的 CSS 代码

中午任务 (Day 4-5):
  [ ] 创建 frontend/popup.js
  [ ] 复制完整的 JavaScript 代码
  [ ] 验证脚本导入 (api-client, exclusion-store, exclusion-filter)

下午任务 (Day 5):
  [ ] 在 Chrome 中测试 Popup:
      [ ] 打开扩展详情
      [ ] 检查 Popup 是否显示
      [ ] 检查列表是否加载
      [ ] 检查按钮是否工作

验收标准:
  [ ] Popup 显示当前域名和状态
  [ ] 显示排除列表 (如果有)
  [ ] 可以添加新域名
  [ ] 可以删除现有域名
  [ ] 无 Console 错误
  [ ] 样式美观清晰
```

**遇到问题?**
查看: `IMPLEMENTATION_PLAN_SIMPLIFIED.md` → `Week 2: 前端 UI` → 完整代码和 CSS

---

### ✅ Day 6: 预设对话框

**目标**: 实现首次使用时的预设建议对话框

```
早上任务:
  [ ] 创建 frontend/modules/exclusion/preset-dialog.js
  [ ] 复制完整的 PresetDialog 类
  [ ] 复制 CSS 样式代码
  [ ] 检查 9 个预设域名是否正确

中午任务:
  [ ] 更新 frontend/popup.js:
      [ ] 在 initializePopup 中添加预设对话框调用
      [ ] 导入 PresetDialog 类

下午任务:
  [ ] 测试预设对话框:
      [ ] 清空 localStorage
      [ ] 打开 Popup → 应该显示对话框
      [ ] 验证 9 个预设是否显示
      [ ] 点击应用 → 应该添加到列表
      [ ] 再次打开 Popup → 不应该显示对话框

验收标准:
  [ ] 对话框首次显示
  [ ] 包含 9 个预设 (3 组)
  [ ] 用户可以勾选/取消
  [ ] 点击应用后添加到数据库
  [ ] 下次打开不再显示
  [ ] 样式美观，居中显示
  [ ] 无 JavaScript 错误
```

**遇到问题?**
查看: `IMPLEMENTATION_PLAN_SIMPLIFIED.md` → `Week 2: 前端 UI` → `Day 3: 预设对话框`

---

## 📅 Week 3: 集成与测试

### ✅ Day 7: content.js 集成

**目标**: 在内容脚本中加入排除检查逻辑

```
早上任务:
  [ ] 打开 frontend/content.js
  [ ] 在最顶部添加这段代码:

async function checkAndInitialize() {
  try {
    const userId = localStorage.getItem('user_id') || 'default_user';
    const exclusionStore = new ExclusionStore(apiClient, userId);
    const filter = new ExclusionFilter(exclusionStore);

    const isExcluded = await filter.shouldExcludeDomain(window.location.href);
    if (isExcluded) {
      console.log('[MixRead] 此网站被排除，不加载插件');
      return;
    }

    // 原有的高亮加载代码...
    initializeHighlight();
  } catch (error) {
    console.error('[MixRead] 初始化失败:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndInitialize);
} else {
  checkAndInitialize();
}

  [ ] 保存文件
  [ ] 验证导入路径正确

中午任务:
  [ ] 测试排除功能:
      [ ] 从 Popup 添加 localhost:8002 到排除列表
      [ ] 访问 localhost:8002 → 应该无高亮
      [ ] 访问 github.com → 应该有高亮
      [ ] 检查 Console → 应该有 [MixRead] 日志

下午任务:
  [ ] 测试通配符:
      [ ] 添加 localhost:* 到排除列表
      [ ] 访问 localhost:8000, localhost:8001 等 → 都应该无高亮
      [ ] 其他网站 → 有高亮

验收标准:
  [ ] 排除的网站不加载高亮
  [ ] 未排除的网站正常加载
  [ ] 支持通配符匹配
  [ ] Console 有清晰的日志
  [ ] 无错误
```

**遇到问题?**
查看: `IMPLEMENTATION_PLAN_SIMPLIFIED.md` → `Week 3: 集成与测试` → `Day 1: content.js 集成`

---

### ✅ Day 8-9: 完整功能测试

**目标**: 运行所有测试场景，修复任何 bug

```
早上任务 (Day 8):
  运行测试场景 1: 基础功能

  [ ] 后端 API 测试
      [ ] POST /users/{id}/excluded-domains → 添加成功
      [ ] GET /users/{id}/excluded-domains → 返回列表
      [ ] DELETE /users/{id}/excluded-domains/{domain} → 删除成功
      [ ] POST /users/{id}/excluded-domains/batch → 批量添加成功

  [ ] 前端 Store 测试
      [ ] addDomain() → 成功调用 API
      [ ] getExcludedDomains() → 返回列表
      [ ] removeDomain() → 成功删除
      [ ] addMultipleDomains() → 批量添加

中午任务 (Day 8-9):
  运行测试场景 2: UI 功能

  [ ] Popup 打开
      [ ] 显示当前域名
      [ ] 显示状态（启用/已禁用）
      [ ] 显示排除列表

  [ ] 预设对话框（首次）
      [ ] 显示 9 个预设
      [ ] 用户可勾选/取消
      [ ] 点击应用 → 添加到列表
      [ ] 下次打开不再显示

  [ ] 添加域名
      [ ] 输入域名 + 点击添加
      [ ] 域名出现在列表
      [ ] 支持回车快速添加

  [ ] 删除域名
      [ ] 点击删除按钮
      [ ] 域名从列表移除

下午任务 (Day 9):
  运行测试场景 3: content.js 集成

  [ ] 访问被排除的网站
      [ ] localhost:8002 → 不加载高亮
      [ ] Console 显示 "[MixRead] 此网站被排除"

  [ ] 访问未被排除的网站
      [ ] github.com → 正常加载高亮
      [ ] 显示高亮单词

  [ ] 动态更新
      [ ] 从 Popup 添加排除
      [ ] 刷新页面
      [ ] 验证排除生效

  [ ] 性能测试
      [ ] 域名检查速度 < 50ms
      [ ] 列表加载 < 100ms
      [ ] 无内存泄漏

验收标准:
  [ ] 所有测试场景 100% 通过
  [ ] 没有 Console 错误
  [ ] API 响应时间正常
  [ ] 页面加载不受影响
```

**遇到问题?**
查看: `IMPLEMENTATION_PLAN_SIMPLIFIED.md` → `Week 3: 集成与测试` → 完整测试场景

---

### ✅ Day 10: 代码审查 + 优化 + 准备发布

**目标**: 最终审查，优化性能，准备发布

```
早上任务:
  [ ] 代码审查
      [ ] 后端代码清晰，无冗余
      [ ] 前端代码清晰，无冗余
      [ ] 所有导入路径正确
      [ ] 无 TODO 或 FIXME 注释

  [ ] 性能检查
      [ ] 运行 Chrome DevTools Audits
      [ ] 检查 Network 标签
      [ ] 确保无多余请求

中午任务:
  [ ] 文档更新
      [ ] 更新 README 文件（如需要）
      [ ] 记录 API 端点
      [ ] 记录前端模块结构

  [ ] 最终测试
      [ ] 在 Chrome 中运行完整测试
      [ ] 多个网站测试
      [ ] 检查所有功能

下午任务:
  [ ] Git 提交
      [ ] git add . (添加所有文件)
      [ ] git commit -m "feat: implement domain exclusion feature"
      [ ] git log --oneline (验证提交)

  [ ] 准备发布
      [ ] 更新 manifest.json 版本号
      [ ] 生成扩展 .zip 文件 (如需要)
      [ ] 记录发布说明

验收标准:
  [ ] 代码无明显问题
  [ ] 所有测试通过
  [ ] 性能达标
  [ ] 文档完整
  [ ] 已提交到 Git
  [ ] 准备发布！
```

---

## 📊 每周目标

### Week 1 目标: ✅ 完整的后端 API
```
完成:
  ✓ ExcludedDomainModel
  ✓ ExcludedDomainRepository
  ✓ ExclusionApplicationService
  ✓ 4 个 API endpoints
  ✓ 所有单元测试
  ✓ 前端 Store 和 Filter

验证:
  ✓ 所有 API 测试通过
  ✓ 数据库操作正常
```

### Week 2 目标: ✅ 完整的前端 UI
```
完成:
  ✓ Popup HTML/CSS/JS
  ✓ 排除列表管理界面
  ✓ 预设对话框
  ✓ 用户交互逻辑

验证:
  ✓ Popup 显示和交互正常
  ✓ 预设对话框首次显示
  ✓ 可以管理排除列表
```

### Week 3 目标: ✅ 完整功能和发布
```
完成:
  ✓ content.js 集成
  ✓ 完整功能测试
  ✓ bug 修复
  ✓ 代码优化
  ✓ 文档更新
  ✓ 准备发布

验证:
  ✓ 所有测试场景通过
  ✓ 功能完整可用
  ✓ 代码质量合格
```

---

## 🚨 如果遇到阻碍

### 问题: 数据库迁移失败

```
检查清单:
  [ ] Alembic 是否安装? (pip list | grep alembic)
  [ ] 是否在 backend 目录? (pwd)
  [ ] 是否有 alembic 目录? (ls alembic)

解决方案:
  1. 查看 IMPLEMENTATION_PLAN_SIMPLIFIED.md Day 1 数据库迁移部分
  2. 如果用 Alembic，按步骤运行
  3. 如果手动，查看 SQL 语句是否正确
```

### 问题: API 返回 404

```
检查清单:
  [ ] 后端是否启动? (curl http://localhost:8000/docs)
  [ ] URL 是否正确? (查看代码中的路由前缀)
  [ ] 方法是否正确? (POST vs GET vs DELETE)

解决方案:
  1. 检查 routes.py 中的 @router 装饰器
  2. 查看是否添加了路由导入
  3. 验证 FastAPI 应用中是否包含了路由
```

### 问题: Popup 显示错误

```
检查清单:
  [ ] Console 有什么错误? (F12 → Console)
  [ ] 导入路径是否正确? (查看 popup.js 顶部的导入)
  [ ] HTML 文件是否存在? (ls frontend/popup.html)
  [ ] CSS 样式是否加载? (F12 → Elements)

解决方案:
  1. 打开 Chrome DevTools (F12)
  2. 查看 Console 标签的错误信息
  3. 根据错误调整代码
  4. 查看 DEVELOPMENT_START_HERE.md 常见问题部分
```

---

## ✅ 完成标志

### 当你看到这些，说明已经成功：

```
后端完成:
  ✅ API 返回 200 状态码
  ✅ 数据正确保存到数据库
  ✅ pytest 输出: 所有测试通过

前端完成:
  ✅ Popup 显示正确
  ✅ 可以添加/删除域名
  ✅ 预设对话框首次显示
  ✅ Console 无红色错误

集成完成:
  ✅ localhost:8002 无高亮
  ✅ github.com 有高亮
  ✅ [MixRead] 日志正常显示
  ✅ 所有测试场景通过
```

---

## 📞 需要帮助？

| 遇到什么问题 | 查看这个文件 | 位置 |
|-------------|-----------|------|
| 代码不知道怎么写 | IMPLEMENTATION_PLAN_SIMPLIFIED.md | Week X 对应部分 |
| API 测试不通过 | DEVELOPMENT_START_HERE.md | Step 4 |
| Popup 显示错误 | DEVELOPMENT_START_HERE.md | 常见问题 |
| 整体不理解 | README_DOMAIN_EXCLUSION.md | 项目总览 |
| 想了解后续优化 | FUTURE_OPTIMIZATION_ROADMAP.md | Phase 2 参考 |

---

**祝开发顺利！** 💪✨

每完成一个任务，更新上面的检查列表。3 周后，你将拥有一个完整的 Domain Exclusion 功能！


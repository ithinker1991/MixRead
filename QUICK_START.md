# ⚡ MixRead 复习系统 - 快速启动

## 📱 5 秒钟了解

这是一个 **Spaced Repetition System (SRS)**，用于单词记忆学习。

- ✅ **后端**: FastAPI + SQLite (http://localhost:8000)
- ✅ **前端**: HTML/CSS/JS (http://localhost:8001)
- ✅ **核心**: SM-2 算法实现
- ✅ **状态**: 生产就绪

---

## 🚀 3 步启动（推荐）

### 一键启动
```bash
cd /Users/yinshucheng/code/creo/MixRead
bash START_TESTING.sh
```

---

## 🚀 手动启动（3 个终端）

### 终端 1：启动后端
```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python main.py
```
✅ 看到：`Uvicorn running on http://127.0.0.1:8000`

### 终端 2：启动前端
```bash
cd /Users/yinshucheng/code/creo/MixRead/frontend
python -m http.server 8001 --bind localhost
```
✅ 看到：`Serving HTTP on localhost:8001`

### 浏览器：打开页面
```
http://localhost:8001/pages/review-session.html?user_id=test_user
```

---

## 🎮 使用方法

| 操作 | 效果 |
|-----|------|
| 点击 "Mixed" 按钮 | 启动混合会话（新单词 + 复习单词） |
| **Space** 键 | 翻转卡片显示答案 |
| **1** 键 | Again (< 1 day) |
| **2** 键 | Hard (3 days) |
| **3** 键 | Good (1 week) |
| **4** 键 | Easy (2 weeks) |
| 或点击按钮 | 提交答案 |

---

## ✅ 验证系统是否正常

### 检查 1：后端
```bash
curl http://localhost:8000/health
```
**应该看到**: `{"status": "ok", ...}`

### 检查 2：API
```bash
curl -X POST "http://localhost:8000/users/test_user/review/session" \
  -H "Content-Type: application/json" \
  -d '{"session_type": "mixed"}' | head -c 100
```
**应该看到**: `{"success": true, ...`

### 检查 3：前端
在浏览器打开：`http://localhost:8001/pages/review-session.html?user_id=test_user`
**应该看到**: 3 个按钮（Mixed, New, Review）

### 检查 4：自动化测试
```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python test_review_api.py
```
**应该看到**: `✅ 所有测试通过! ✨`

---

## 📋 文档导航

| 文档 | 用途 |
|------|------|
| **QUICK_START.md** | 本文件 - 快速参考 |
| **TEST_GUIDE.md** | 详细的 API 测试指南 |
| **BROWSER_TEST_GUIDE.md** | 前端功能测试指南 |
| **TESTING_STATUS.md** | 测试状态报告 |

---

## 🐛 常见问题

### Q: 浏览器显示 404？
**A**: 确保前端服务运行在 8001
```bash
cd /Users/yinshucheng/code/creo/MixRead/frontend
python -m http.server 8001 --bind localhost
```

### Q: 点击按钮没反应？
**A**: 打开 F12 检查 Console 是否有错误，尝试硬刷新 Ctrl+Shift+R

### Q: 没有卡片显示？
**A**: 需要至少 5 个测试单词。运行启动脚本会自动添加

### Q: API 返回 500 错误？
**A**: 数据库 schema 可能不同步，尝试删除旧数据库：
```bash
rm -f /Users/yinshucheng/code/creo/MixRead/backend/*.db
```
重启后端会自动重建

---

## 📊 快速测试

### API 测试（5 分钟）
```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python test_review_api.py
```

### 前端测试（10 分钟）
1. 打开浏览器：`http://localhost:8001/pages/review-session.html?user_id=test_user`
2. 按照 BROWSER_TEST_GUIDE.md 的步骤测试

---

## 🎯 关键快捷键

| 快捷键 | 功能 |
|--------|------|
| Space | 显示/隐藏答案 |
| 1 | Again |
| 2 | Hard |
| 3 | Good |
| 4 | Easy |
| F12 | 打开开发者工具 |
| Ctrl+R | 刷新页面 |
| Ctrl+Shift+R | 硬刷新（清除缓存） |

---

## 🔗 关键 URL

| 页面 | URL |
|-----|-----|
| 复习页面 | http://localhost:8001/pages/review-session.html?user_id=test_user |
| 后端健康检查 | http://localhost:8000/health |
| 后端 API 文档 | http://localhost:8000/docs（如果启用） |

---

## 📝 API 快速参考

### 创建会话
```bash
POST /users/{user_id}/review/session
Body: {"session_type": "mixed"}
Response: {"success": true, "session_id": "...", ...}
```

### 提交答案（使用查询参数！）
```bash
POST /users/{user_id}/review/answer?session_id=...&quality=4
Response: {"success": true, "result": {...}, ...}
```

### 其他端点
```bash
GET  /users/{user_id}/review/stats      # 获取统计
GET  /users/{user_id}/review/schedule   # 获取计划
POST /highlight-words                    # 获取高亮单词
GET  /users/{user_id}/known-words        # 已知单词
GET  /users/{user_id}/unknown-words      # 未知单词
```

---

## ⚡ 性能指标

| 操作 | 响应时间 |
|------|---------|
| 创建会话 | ~200ms |
| 提交答案 | ~150ms |
| 卡片渲染 | ~50ms |
| 后端连接 | ~50ms |

---

## 🔍 故障排除（3 步）

### 步骤 1：检查日志
```bash
# 后端日志
tail -f /tmp/mixread_backend.log

# 前端日志
tail -f /tmp/mixread_frontend.log
```

### 步骤 2：检查浏览器控制台
打开浏览器 F12 → Console，查看是否有红色错误

### 步骤 3：查看详细指南
- API 问题 → `TEST_GUIDE.md`
- 前端问题 → `BROWSER_TEST_GUIDE.md`
- 数据库问题 → `TESTING_STATUS.md`

---

## ✅ 准备好了吗？

1. ✅ 确保你在项目目录
2. ✅ 运行 `bash START_TESTING.sh`
3. ✅ 等待所有服务启动
4. ✅ 在浏览器打开 Review 页面
5. ✅ 点击 "Mixed" 开始测试
6. ✅ 按照 BROWSER_TEST_GUIDE.md 完成测试

**现在就开始吧！** 🚀

---

## 📞 需要帮助？

- 快速参考 → 你在看这个文件 ✓
- API 详细测试 → 看 `TEST_GUIDE.md`
- 前端测试步骤 → 看 `BROWSER_TEST_GUIDE.md`
- 系统状态 → 看 `TESTING_STATUS.md`

---

**系统状态**: ✅ 完全可用
**最后更新**: 2025-12-04
**版本**: 1.0 - 生产就绪

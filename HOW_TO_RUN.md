# 🚀 如何运行 MixRead 系统

有 3 种方式可以启动系统。选择最适合你的一种。

---

## 方式 1: 使用 VSCode (推荐) ⭐⭐⭐

### 步骤 1: 打开项目
1. 在 VSCode 中打开项目文件夹: `/Users/yinshucheng/code/creo/MixRead`

### 步骤 2: 启动所有服务
1. 按 **F5** (或点击 Run 图标 → "🎯 启动所有服务")
2. 等待两个终端都显示"运行中"的提示
3. 后端: `Uvicorn running on http://127.0.0.1:8000`
4. 前端: `Serving HTTP on localhost:8001`

### 步骤 3: 打开浏览器
打开链接:
```
http://localhost:8001/pages/review-session.html?user_id=test_user
```

✅ 完成！开始学习！

---

## 方式 2: 使用启动脚本

### 一键启动所有
```bash
cd /Users/yinshucheng/code/creo/MixRead
bash START_TESTING.sh
```

脚本会自动:
- 启动后端 (8000)
- 启动前端 (8001)
- 添加测试数据
- 运行 API 测试

然后打开浏览器: http://localhost:8001/pages/review-session.html?user_id=test_user

---

## 方式 3: 手动启动 (最灵活)

### 终端 1 - 启动后端
```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python main.py
```

看到输出: `Uvicorn running on http://127.0.0.1:8000` ✅

### 终端 2 - 启动前端 (新终端)
```bash
cd /Users/yinshucheng/code/creo/MixRead/frontend
python -m http.server 8001 --bind localhost
```

看到输出: `Serving HTTP on localhost:8001` ✅

### 浏览器 - 打开页面
```
http://localhost:8001/pages/review-session.html?user_id=test_user
```

---

## 🎮 使用说明

当页面加载成功后，你会看到 3 个按钮。

### 快速开始
1. **点击 "Mixed"** 按钮开始复习
2. **按 Space** 显示单词定义
3. **按 1-4** 或 **点击按钮** 评分:
   - 1️⃣ = Again (记不住)
   - 2️⃣ = Hard (有点难)
   - 3️⃣ = Good (还不错)
   - 4️⃣ = Easy (很容易)
4. **继续** 直到完成所有卡片

---

## ✅ 验证系统运行正常

### 检查后端
```bash
curl http://localhost:8000/health
```

应该看到:
```json
{"status":"ok","version":"0.2.0",...}
```

### 检查前端
在浏览器打开:
```
http://localhost:8001/pages/review-session.html?user_id=test_user
```

应该看到页面加载成功，显示 3 个按钮

### 运行 API 测试
```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python test_review_api.py
```

应该看到: `✅ 所有测试通过! ✨`

---

## 🛑 停止服务

### VSCode 中
点击 Run 面板中的红色停止按钮

### 终端中
按 **Ctrl+C** 停止服务

### 清理旧进程
```bash
pkill -f 'python -m http.server 8001'
pkill -f 'uvicorn'
```

---

## 🔗 重要 URL

| 用途 | URL |
|------|-----|
| **复习页面** | http://localhost:8001/pages/review-session.html?user_id=test_user |
| **后端健康检查** | http://localhost:8000/health |
| **前端主页** | http://localhost:8001/ |

---

## 📚 相关文档

- **VSCODE_SETUP.md** - VSCode 配置详细说明
- **QUICK_START.md** - 快速参考卡片
- **TEST_GUIDE.md** - 测试指南
- **BROWSER_TEST_GUIDE.md** - 浏览器测试步骤

---

## 🐛 遇到问题？

### 前端页面打不开 (404)
1. 确保前端服务在运行 (看到 "Serving HTTP")
2. 检查 URL 是否正确
3. 尝试硬刷新: Ctrl+Shift+R

### 后端无法启动
1. 检查端口 8000 是否被占用
2. 运行: `lsof -i :8000`
3. 清理旧进程: `pkill -f 'uvicorn'`

### API 测试失败
1. 确保后端已启动
2. 等待 3 秒后重试
3. 查看后端终端的错误信息

### 没有卡片显示
1. 数据库中应该有测试数据
2. 运行 `bash START_TESTING.sh` 会自动添加

---

## 🎯 推荐的启动顺序

**最快**: 按 F5 (VSCode)

**最稳定**: `bash START_TESTING.sh`

**最灵活**: 手动启动两个终端

---

**现在开始吧！** 🚀

选择你喜欢的方式，启动系统，打开浏览器，开始学习！

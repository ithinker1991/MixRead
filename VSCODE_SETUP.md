# 🎯 VSCode 启动配置指南

本文档说明如何使用 VSCode 快速启动 MixRead 系统。

---

## 📋 可用的启动配置

### 1. 启动所有服务 (推荐) ⭐

**快捷方式**:
- 按 `F5` 或点击 Run → "🎯 启动所有服务 (Start All Services)"

**作用**: 同时启动后端 (8000) 和前端 (8001)

**后续步骤**:
1. 等待两个终端都显示"运行中"
2. 在浏览器打开: http://localhost:8001/pages/review-session.html?user_id=test_user
3. 开始使用 MixRead

---

## 🚀 单独启动服务

### 启动后端
- 点击 Run → "后端服务器 (Backend)"
- 或按 Ctrl+Shift+D 打开 Run and Debug，选择该选项

### 启动前端
- 点击 Run → "🌐 前端服务器 (Frontend Server)"
- 等待显示 "Serving HTTP on localhost:8001"

### 运行 API 测试
- 点击 Run → "🧪 复习系统 API 测试 (Review API Tests)"
- 查看测试结果

---

## 📝 可用的任务 (Tasks)

打开 VSCode 命令面板 (`Ctrl+Shift+P` 或 `Cmd+Shift+P`)，搜索 "Run Task"

### 🌐 前端相关任务

| 任务 | 功能 |
|------|------|
| **🌐 启动前端服务器 (Frontend)** | 启动前端 HTTP Server (8001) |
| **🎯 启动所有服务 (Backend + Frontend)** | 同时启动后端和前端 |
| **🧹 杀死旧进程 (Kill Old Processes)** | 清理残留的后端/前端进程 |

### 后端相关任务

| 任务 | 功能 |
|------|------|
| **🚀 启动后端服务器** | 启动 FastAPI 后端 (8000) |
| **🧪 运行后端测试** | 运行基础后端 API 测试 |
| **🧪 运行复习系统 API 测试** | 运行完整的复习系统测试 |
| **📦 后端 - 安装依赖** | 安装 Python 依赖 |

### 工具任务

| 任务 | 功能 |
|------|------|
| **🧹 清理 - Python 缓存** | 清理 __pycache__ 和 .pyc 文件 |
| **🐛 VSCode 问题诊断** | 检查 Python 环境配置 |

---

## 🎮 快速操作步骤

### 第一次使用

1. **打开 VSCode**
   - File → Open Folder → 选择 `/Users/yinshucheng/code/creo/MixRead`

2. **启动所有服务**
   - 按 `F5` 或点击运行图标
   - 选择 "🎯 启动所有服务 (Start All Services)"
   - 等待两个终端都显示"运行中"

3. **打开浏览器**
   - 访问: http://localhost:8001/pages/review-session.html?user_id=test_user

4. **开始学习**
   - 点击 "Mixed" 开始复习

### 快速测试

1. **运行 API 测试** (确保后端已启动)
   - Run → "🧪 运行复习系统 API 测试 (Review API Tests)"

2. **查看测试结果**
   - 集成终端会显示完整的测试输出
   - ✅ 5/5 通过表示系统正常

---

## 🔧 自定义配置

### 修改后端端口

编辑 `.vscode/launch.json`，修改后端配置中的端口号：

```json
"args": [
  "main:app",
  "--reload",
  "--host", "0.0.0.0",
  "--port", "8000"  // 改为你想要的端口
]
```

### 修改前端端口

编辑 `.vscode/tasks.json`，修改前端任务中的端口号：

```bash
"command": "cd frontend && python -m http.server 8001 --bind localhost"
// 改为: python -m http.server YOUR_PORT --bind localhost
```

---

## 🐛 常见问题

### 问题 1: 端口已被占用

**错误**: `Address already in use`

**解决**:
1. 运行任务: "🧹 杀死旧进程 (Kill Old Processes)"
2. 等待 1 秒
3. 重新启动服务

### 问题 2: 前端页面打不开

**错误**: 404 Not Found

**解决**:
1. 检查前端终端是否显示 "Serving HTTP"
2. 如果没有，启动任务: "🌐 启动前端服务器 (Frontend)"
3. 等待 3 秒后在浏览器刷新

### 问题 3: API 测试失败

**错误**: `Failed to connect to backend`

**解决**:
1. 确保后端已启动
2. 检查后端终端是否显示 "Uvicorn running on"
3. 如果显示 ERROR，查看错误信息并修复

### 问题 4: 无法停止服务

**方案 1**: 点击终端中的停止按钮 (红色方形)

**方案 2**: 运行任务 "🧹 杀死旧进程 (Kill Old Processes)"

---

## 📱 使用调试功能

### 调试后端

1. 在 Python 代码中添加断点 (点击行号旁边)
2. 启动 "后端服务器 (Backend)" 配置
3. 代码会在断点处停止
4. 使用调试工具栏控制执行

### 调试前端

1. 在浏览器中按 F12 打开开发者工具
2. 在 Sources 标签中设置断点
3. 执行相应操作触发代码
4. 查看变量和执行流程

---

## 🚀 加速启动技巧

### 一键启动所有
1. 打开 VSCode 的 Run 面板
2. 选择 "🎯 启动所有服务 (Start All Services)"
3. 自动启动后端和前端

### 快速重启
1. 点击运行面板中的停止按钮
2. 等待 1 秒
3. 再点击开始按钮

### 后台运行
- 将终端分离到一个专用窗口中
- 继续编辑代码，不影响运行的服务

---

## ✅ 验证配置正确

1. **F5 启动所有服务**
   - 看到两个终端，分别显示后端和前端信息

2. **浏览器访问页面**
   - 看到 MixRead 的 Review 界面

3. **运行 API 测试**
   - 选择 "🧪 运行复习系统 API 测试 (Review API Tests)"
   - 看到 5/5 测试通过

---

## 📞 快速参考

| 操作 | 快捷键/方法 |
|------|----------|
| 启动所有服务 | F5 或 Run → Start All Services |
| 停止所有服务 | 点击停止按钮或 Ctrl+C |
| 打开运行面板 | Ctrl+Shift+D 或 Run 菜单 |
| 打开任务面板 | Ctrl+Shift+P 搜索 "Run Task" |
| 前端 URL | http://localhost:8001/pages/review-session.html?user_id=test_user |
| 后端健康检查 | curl http://localhost:8000/health |

---

## 🎯 下一步

- ✅ 启动所有服务
- ✅ 打开浏览器测试前端
- ✅ 运行 API 测试验证后端
- ✅ 开始使用 MixRead

---

**准备好了吗？按 F5 立即启动！** 🚀

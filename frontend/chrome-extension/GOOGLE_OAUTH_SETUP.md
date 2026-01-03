# Google OAuth Setup Guide

本文档说明如何为 MixRead Chrome 扩展配置 Google OAuth 登录功能。

## 前置条件

- Google 账号
- Chrome 浏览器
- 已加载 MixRead 扩展（开发模式）

## 步骤 1: 获取 Chrome Extension ID

1. 打开 Chrome，访问 `chrome://extensions`
2. 启用右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择 `frontend/chrome-extension` 目录
4. 记录扩展的 **ID**（32 位字符串，如 `abcdefghijklmnopqrstuvwxyzabcdef`）

## 步骤 2: 创建 Google Cloud Project

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击顶部的项目选择器，然后点击 **新建项目**
3. 输入项目名称（如 `MixRead`），点击 **创建**
4. 等待项目创建完成

## 步骤 3: 配置 OAuth 同意屏幕

1. 在左侧菜单选择 **API 和服务** > **OAuth 同意屏幕**
2. 选择 **外部** 用户类型，点击 **创建**
3. 填写必要信息：
   - 应用名称: `MixRead`
   - 用户支持电子邮件: 你的邮箱
   - 开发者联系信息: 你的邮箱
4. 点击 **保存并继续**
5. 在 **范围** 页面，点击 **添加或移除范围**，选择：
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
6. 点击 **更新**，然后 **保存并继续**
7. 在 **测试用户** 页面，添加你的 Google 账号邮箱
8. 点击 **保存并继续**，完成配置

## 步骤 4: 创建 OAuth 客户端 ID

1. 在左侧菜单选择 **API 和服务** > **凭据**
2. 点击 **创建凭据** > **OAuth 客户端 ID**
3. 应用类型选择 **Chrome 扩展程序**
4. 名称输入 `MixRead Extension`
5. 在 **应用 ID** 字段输入步骤 1 中获取的扩展 ID
6. 点击 **创建**
7. 记录生成的 **客户端 ID**（格式如 `123456789-abc.apps.googleusercontent.com`）

## 步骤 5: 配置 Chrome Extension

编辑 `frontend/chrome-extension/manifest.json`，将 `oauth2.client_id` 替换为你的客户端 ID：

```json
{
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid"
    ]
  }
}
```

## 步骤 6: 配置后端环境变量

在 `backend/` 目录创建 `.env` 文件（或设置环境变量）：

```bash
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
SECRET_KEY=your_random_secret_key_for_jwt
```

生成 SECRET_KEY 的方法：

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## 步骤 7: 重新加载扩展

1. 访问 `chrome://extensions`
2. 点击 MixRead 扩展卡片上的 **刷新** 按钮
3. 扩展现在可以使用 Google 登录功能

## 验证配置

1. 点击 MixRead 扩展图标打开 popup
2. 点击 **Google 登录** 按钮
3. 应该弹出 Google 登录窗口
4. 登录成功后，popup 应显示用户头像和邮箱

## 常见问题

### 错误: "OAuth2 not granted or revoked"

- 确保 manifest.json 中的 client_id 正确
- 确保 GCP Console 中配置的扩展 ID 与实际 ID 匹配
- 尝试在 `chrome://extensions` 中移除并重新加载扩展

### 错误: "Access blocked: This app's request is invalid"

- 检查 OAuth 同意屏幕是否已配置
- 确保你的 Google 账号已添加为测试用户
- 检查 OAuth 客户端类型是否为 "Chrome 扩展程序"

### 错误: "Cannot connect to server"

- 确保后端服务正在运行: `cd backend && python main.py`
- 检查后端是否监听在 `http://localhost:8000`
- 检查 manifest.json 中的 `host_permissions` 是否包含后端地址

### 后端返回 401 错误

- 确保后端的 `GOOGLE_CLIENT_ID` 环境变量与 manifest.json 中的一致
- 检查后端日志获取详细错误信息

## 生产环境部署

发布到 Chrome Web Store 时：

1. 在 GCP Console 创建新的 OAuth 客户端 ID（使用 Web Store 分配的扩展 ID）
2. 将 OAuth 同意屏幕发布为 **生产** 状态
3. 更新 manifest.json 中的 client_id
4. 更新后端环境变量中的 GOOGLE_CLIENT_ID

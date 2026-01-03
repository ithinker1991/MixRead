# Implementation Plan: Google Login

## Overview

本实现计划将 Google 登录功能分解为可执行的编码任务。后端已有部分实现，主要工作集中在完善配置验证、前端 UI 集成和测试。

## Tasks

- [x] 1. 完善后端 AuthService 配置验证

  - [x] 1.1 添加 GOOGLE_CLIENT_ID 配置检查
    - 在 `backend/application/auth_service.py` 中添加 `_validate_config()` 方法
    - 当 GOOGLE_CLIENT_ID 未配置时抛出明确错误
    - _Requirements: 1.2, 1.3_
  - [x] 1.2 编写配置验证单元测试
    - 测试缺少 GOOGLE_CLIENT_ID 时返回正确错误
    - 测试配置正确时正常初始化
    - _Requirements: 1.2, 1.3_

- [x] 2. 完善后端用户创建/检索逻辑

  - [x] 2.1 验证 UserRepository.get_by_google_id 实现
    - 检查 `backend/infrastructure/repositories.py` 中的实现
    - 确保通过 google_id 正确查询用户
    - _Requirements: 6.2_
  - [x] 2.2 验证 UserRepository.update_google_info 实现
    - 确保正确存储 google_id, email, avatar_url
    - _Requirements: 6.1, 6.3_
  - [x] 2.3 编写用户创建/检索往返属性测试
    - **Property 1: User Creation/Retrieval Round-Trip**
    - **Validates: Requirements 2.4, 6.1, 6.2, 6.3**

- [x] 3. 完善后端 Token 验证错误处理

  - [x] 3.1 增强 verify_google_token 错误处理
    - 在 `backend/application/auth_service.py` 中完善错误消息
    - 确保无效 token 返回 HTTP 401 和描述性错误
    - _Requirements: 4.2, 4.4_
  - [x] 3.2 编写无效 Token 拒绝属性测试
    - **Property 2: Invalid Token Rejection**
    - **Validates: Requirements 4.2, 4.4**

- [x] 4. Checkpoint - 后端测试验证

  - 确保所有后端测试通过
  - 如有问题请询问用户

- [x] 5. 配置 Chrome Extension OAuth

  - [x] 5.1 更新 manifest.json OAuth 配置
    - 在 `frontend/chrome-extension/manifest.json` 添加 identity 权限
    - 配置 oauth2 section (client_id 占位符, scopes)
    - _Requirements: 1.1, 1.4_
  - [x] 5.2 创建配置说明文档
    - 在 `frontend/chrome-extension/` 添加 GOOGLE_OAUTH_SETUP.md
    - 说明如何在 GCP Console 创建 OAuth 客户端
    - 说明如何配置 client_id
    - _Requirements: 5.4_

- [x] 6. 实现前端 AuthService 完善

  - [x] 6.1 完善 AuthService.login() 方法
    - 在 `frontend/chrome-extension/shared/auth-service.js` 中完善实现
    - 使用 chrome.identity.getAuthToken 获取 token
    - 发送 token 到后端 /auth/google
    - 存储返回的 session 到 chrome.storage
    - _Requirements: 2.1, 2.2, 2.6_
  - [x] 6.2 完善 AuthService.logout() 方法
    - 清除 chrome.storage 中的 token 和用户数据
    - _Requirements: 3.3_
  - [x] 6.3 实现 AuthService.isLoggedIn() 方法
    - 检查 chrome.storage 中是否存在有效 session
    - _Requirements: 3.1_

- [x] 7. 实现 Popup UI 认证集成

  - [x] 7.1 添加登录/登出按钮事件处理
    - 在 `frontend/chrome-extension/popup.js` 中添加 handleLoginClick()
    - 添加 handleLogoutClick()
    - _Requirements: 2.1, 3.3_
  - [x] 7.2 实现 initializeAuthUI() 函数
    - 页面加载时检查现有 session
    - 根据登录状态显示对应 UI
    - _Requirements: 3.1, 3.2_
  - [x] 7.3 实现 updateAuthUI() 函数
    - 登录后显示用户头像、名称、邮箱
    - 登出后显示登录按钮
    - _Requirements: 2.5, 3.4_

- [x] 8. 实现前端错误处理

  - [x] 8.1 处理 OAuth 取消场景
    - 用户取消 OAuth 流程时静默处理，不显示错误
    - _Requirements: 4.1_
  - [x] 8.2 处理网络错误场景
    - 后端不可达时显示 "Cannot connect to server"
    - _Requirements: 4.3_

- [x] 9. Checkpoint - 集成测试

  - 确保前后端集成正常工作
  - 手动测试登录/登出流程
  - 如有问题请询问用户

- [x] 10. 最终验证
  - [x] 10.1 验证完整登录流程
    - 测试新用户首次登录
    - 测试现有用户重复登录
    - _Requirements: 2.1-2.6, 6.1, 6.2_
  - [x] 10.2 验证会话持久化
    - 关闭并重新打开 popup，验证保持登录状态
    - _Requirements: 3.1, 3.2_
  - [x] 10.3 验证登出功能
    - 测试登出后 UI 正确更新
    - _Requirements: 3.3, 3.4_

## Notes

- 每个任务都引用了具体的需求编号以便追溯
- Checkpoint 任务用于阶段性验证
- 属性测试使用 Hypothesis (Python) 框架
- 后端已有部分实现，主要是完善和测试

# Requirements Document

## Introduction

完善 MixRead Chrome 扩展的 Google 登录功能，使用户能够通过 Google 账号进行身份验证，实现跨设备的数据同步和用户身份管理。当前已有部分实现，需要完善配置、测试流程和错误处理。

## Glossary

- **Chrome_Extension**: MixRead 的 Chrome 浏览器扩展程序
- **Auth_Service**: 后端认证服务，处理 Google Token 验证和用户会话管理
- **Google_OAuth**: Google 的 OAuth 2.0 认证服务
- **ID_Token**: Google 返回的身份验证令牌
- **User_Repository**: 用户数据存储层
- **Popup_UI**: Chrome 扩展的弹出窗口界面

## Requirements

### Requirement 1: Google OAuth 配置

**User Story:** As a developer, I want to properly configure Google OAuth credentials, so that the extension can authenticate users through Google.

#### Acceptance Criteria

1. THE Chrome_Extension SHALL have a valid Google OAuth client_id configured in manifest.json
2. THE Auth_Service SHALL read GOOGLE_CLIENT_ID from environment variables
3. WHEN GOOGLE_CLIENT_ID is not configured, THE Auth_Service SHALL return a clear error message indicating missing configuration
4. THE Chrome_Extension SHALL request appropriate OAuth scopes (email, profile, openid)

### Requirement 2: Google 登录流程

**User Story:** As a user, I want to login with my Google account, so that I can access my vocabulary data across devices.

#### Acceptance Criteria

1. WHEN a user clicks the "Google Login" button, THE Chrome_Extension SHALL initiate the Google OAuth flow using chrome.identity API
2. WHEN Google authentication succeeds, THE Chrome_Extension SHALL send the ID token to the backend Auth_Service
3. WHEN the Auth_Service receives a valid ID token, THE Auth_Service SHALL verify the token with Google
4. WHEN token verification succeeds, THE Auth_Service SHALL create or retrieve the user record
5. WHEN login completes successfully, THE Popup_UI SHALL display the user's avatar, name, and email
6. WHEN login completes successfully, THE Chrome_Extension SHALL store the session token in chrome.storage

### Requirement 3: 用户会话管理

**User Story:** As a user, I want my login session to persist, so that I don't need to login every time I open the browser.

#### Acceptance Criteria

1. WHEN the Popup_UI loads, THE Chrome_Extension SHALL check for existing session token
2. WHILE a valid session exists, THE Popup_UI SHALL display the logged-in user view
3. WHEN a user clicks "Logout", THE Chrome_Extension SHALL clear the session token and user data
4. WHEN a user logs out, THE Popup_UI SHALL display the login view

### Requirement 4: 错误处理

**User Story:** As a user, I want to see clear error messages when login fails, so that I can understand what went wrong.

#### Acceptance Criteria

1. IF Google OAuth flow is cancelled by user, THEN THE Chrome_Extension SHALL handle gracefully without showing error
2. IF Google token verification fails, THEN THE Auth_Service SHALL return HTTP 401 with descriptive error message
3. IF backend is unreachable, THEN THE Chrome_Extension SHALL display "Cannot connect to server" message
4. IF token is expired or invalid, THEN THE Auth_Service SHALL return appropriate error code

### Requirement 5: 开发环境测试支持

**User Story:** As a developer, I want to test Google login in development environment, so that I can verify the implementation works correctly.

#### Acceptance Criteria

1. THE Chrome_Extension SHALL support loading as unpacked extension for development
2. THE Auth_Service SHALL support running on localhost:8000 for development
3. WHEN running in development mode, THE Chrome_Extension SHALL allow http://localhost connections
4. THE system SHALL provide clear documentation for setting up Google OAuth credentials for development

### Requirement 6: 用户数据关联

**User Story:** As a user, I want my vocabulary data to be associated with my Google account, so that I can access it from any device.

#### Acceptance Criteria

1. WHEN a new user logs in with Google, THE User_Repository SHALL create a new user record with google_id
2. WHEN an existing user logs in with Google, THE User_Repository SHALL retrieve the existing user record by google_id
3. THE User_Repository SHALL store user's email and avatar_url from Google profile
4. WHEN user is logged in, THE Chrome_Extension SHALL use the authenticated user_id for all API requests

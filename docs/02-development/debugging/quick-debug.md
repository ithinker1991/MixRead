# 快速调试指南 - 点击高亮单词没有显示定义

## ⚡ 快速检查（5分钟）

### 1. 后端是否运行？
```bash
curl http://localhost:8000/health
```
- ✅ 返回 `{"status":"ok","words_loaded":6860}` → 继续下一步
- ❌ 失败 → 启动后端:
  ```bash
  cd backend
  source venv/bin/activate
  python main.py
  ```

### 2. 重新加载扩展
```
1. 打开 chrome://extensions
2. 找到 MixRead
3. 点击刷新图标 🔄
```

### 3. 测试并查看日志
```
1. 打开 frontend/test.html
2. 按 F12 打开开发者工具
3. 点击 Console 标签
4. 点击一个黄色高亮的单词
```

### 4. 根据日志判断问题

#### 情况 A: 没有任何 [MixRead] 日志
**问题**: 点击事件未绑定
**解决**:
```bash
# 1. 确保扩展已重新加载（步骤 2）
# 2. 刷新测试页面（Cmd+R 或 Ctrl+R）
# 3. 再次点击单词
```

#### 情况 B: 看到日志但没有弹窗
```
[MixRead] Click event triggered for word: beautiful
[MixRead] showTooltip called with word: beautiful
[MixRead] Received response: {success: true, word_info: {...}}
[MixRead] Creating tooltip with word info: {...}
```
**问题**: CSS 样式问题或 tooltip 被其他元素覆盖
**解决**: 检查页面的 Elements 标签，看是否有 `.mixread-tooltip` 元素

#### 情况 C: 错误日志
```
[MixRead] Error getting word info: ...
```
或者
```
Error in handleGetWordInfo: Failed to fetch
```
**问题**: 后端通信失败
**解决**:
1. 检查后端是否运行（步骤 1）
2. 检查 Service Worker 日志:
   - chrome://extensions → MixRead → "检查视图: Service Worker"
   - 查看 Console 中的错误

---

## 🔍 详细调试

如果快速检查没有解决问题，查看完整的调试指南：
- [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) - 完整调试步骤
- [REAL_INSTALLATION_GUIDE.md](./REAL_INSTALLATION_GUIDE.md) - 安装指南

---

## 📞 常见问题快速解答

### Q: 高亮的单词很少或没有高亮
**A**: 调整难度等级
```
1. 点击扩展图标
2. 将滑杆拖到 A1 或 B1
3. 刷新页面
```

### Q: 点击单词后页面卡住
**A**: 检查浏览器控制台错误
```
F12 → Console → 查看红色错误信息
```

### Q: 扩展图标不显示
**A**: 检查图标文件
```bash
ls frontend/images/icon-*.png
# 应该看到 icon-16.png, icon-48.png, icon-128.png
```

---

## ✅ 验证修复

修复后，确认以下都正常：

1. [ ] 打开 test.html 看到黄色高亮
2. [ ] 点击单词看到弹窗
3. [ ] 弹窗包含定义和 CEFR 等级
4. [ ] "Add to Library" 按钮工作
5. [ ] "Close" 按钮关闭弹窗

**全部完成？问题解决！** 🎉

---

**更新**: 2024年11月28日

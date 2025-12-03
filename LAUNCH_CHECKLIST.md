# 🚀 MixRead Launch Checklist - Weekend Edition

**Deadline:** Sunday night
**Target:** Basic MVP ready for production

## Phase 1: Core Features Verification (Done ✅)

- [x] English word highlighting with CEFR levels
- [x] Tooltip with English definitions + pronunciation
- [x] Chinese translation toggle
- [x] Vocabulary tracking with timestamps
- [x] Statistics: today, week, total
- [x] Reading time tracking
- [x] Difficulty slider (A1-C2)

## Phase 2: Backend Deployment (In Progress ⚙️)

### Docker & Containerization
- [ ] Dockerfile created and tested locally
- [ ] docker-compose.yml configured
- [ ] Build successfully: `docker build -t mixread-api .`
- [ ] Run successfully: `docker run -p 8000:8000 mixread-api`
- [ ] Health check working: `curl http://localhost:8000/health`

### Cloud Deployment Choice (Pick ONE)

#### Option A: Railway.app (EASIEST)
- [ ] Create Railway account
- [ ] Connect GitHub repository
- [ ] Deploy with one click
- [ ] Get API endpoint: `https://your-app.railway.app`

#### Option B: Server (VPS/Aliyun/AWS)
- [ ] SSH access to server confirmed
- [ ] Docker & Docker Compose installed
- [ ] Upload code to server
- [ ] Run: `docker-compose up -d`
- [ ] Verify API responds

#### Option C: Heroku (DEPRECATED - Not Recommended)
- [ ] Skip this option (Heroku free tier ended)

### API Configuration
- [ ] Backend running on production
- [ ] API endpoint accessible: `https://api.your-domain.com/health`
- [ ] CORS configured for extension
- [ ] Definition caching working

## Phase 3: Extension Configuration (QUICK)

### Update Chrome Extension
- [ ] Update `frontend/background.js` with production API URL
  ```javascript
  const API_BASE_URL = "https://api.your-domain.com"; // Change this!
  ```
- [ ] Test extension locally
  1. Go to `chrome://extensions/`
  2. Remove old extension
  3. Load unpacked → select `frontend/` folder
  4. Test on a website like bbc.com
  5. Verify definitions appear
  6. Verify stats tracking works

## Phase 4: Domain & SSL (OPTIONAL for MVP)

### Domain Setup (If you have a domain)
- [ ] Domain registered (mixread.ai, mixread.app, etc.)
- [ ] DNS records pointing to server IP
- [ ] Let's Encrypt SSL certificate installed

### If NO domain yet (Use for MVP)
- [ ] Use IP address directly: `https://1.2.3.4:8000`
- [ ] Or use temporary URL: `https://mixread-api-temp.herokuapp.com`
- [ ] Add to CORS whitelist in backend

## Phase 5: Payment System (OPTIONAL for MVP)

### For MVP (Skip payment, focus on users)
- [ ] Focus on getting first users
- [ ] Collect feedback on product
- [ ] Add payment later (Phase 2)

### If you want payment from day 1
- [ ] Choose provider: Gumroad (easiest), Stripe, or PayPal
- [ ] Create product and get link
- [ ] Add "Support" button to extension popup
- [ ] Or create simple landing page

## Phase 6: Testing Before Launch (CRITICAL)

### Extension Testing
- [x] Words are highlighted correctly
- [x] Click on word shows definition
- [x] Chinese toggle works
- [x] Difficulty slider updates highlighting
- [x] "Add to Library" saves words
- [x] Statistics display correctly
- [x] Pronunciation button works

### Production Testing
- [ ] Test on production API (not localhost)
- [ ] Test on multiple websites:
  - [ ] BBC News (News)
  - [ ] Medium (Blog/Articles)
  - [ ] Wikipedia (Reference)
- [ ] Test with different difficulty levels
- [ ] Test vocabulary library (add 10+ words)
- [ ] Clear vocabulary and verify stats reset

### Performance Check
- [ ] Page loads in < 2 seconds
- [ ] No console errors (F12 → Console)
- [ ] Tooltip appears quickly (< 500ms)
- [ ] Large pages don't lag

## Phase 7: Documentation & Support

### README & Guides
- [ ] README.md is clear
- [ ] Installation steps are simple
- [ ] Troubleshooting section is helpful

### User Support
- [ ] Create simple FAQ
- [ ] List common issues
- [ ] Include contact/feedback method

## Phase 8: Launch & Announcement

### Pre-Launch (Saturday)
- [ ] Test everything one final time
- [ ] Prepare launch message
- [ ] Prepare screenshots for Chrome Web Store

### Chrome Web Store (Can do later, not blocking MVP)
- [ ] Submit extension to Chrome Web Store
  - Note: Approval takes 1-3 days
  - Can launch with direct link first

### Direct Distribution (Can do immediately)
- [ ] Create GitHub releases with extension ZIP
- [ ] Add installation instructions
- [ ] Create landing page (simple HTML)

### Announcement Channels
- [ ] Twitter/X (if applicable)
- [ ] Product Hunt (optional)
- [ ] Hacker News (optional)
- [ ] Personal network
- [ ] Discord/Slack communities

---

## 📊 Priority Matrix for Weekend

### MUST DO (Before Sunday midnight)
1. ✅ Backend features working
2. ✅ Extension working locally
3. ⚙️ Deploy backend to cloud (pick ONE option)
4. ⚙️ Update extension to use production API
5. ⚙️ Final testing cycle
6. ✅ Basic documentation

### NICE TO HAVE (If time permits)
1. Domain setup
2. SSL certificate
3. Chrome Web Store submission
4. Landing page
5. Payment system

### PHASE 2 (After launch)
1. User feedback collection
2. Bug fixes based on feedback
3. Performance optimization
4. Payment system if needed
5. Advanced features

---

## 🎯 Deployment Path (Choose ONE)

### Path A: Fastest (Railway.app) - 30 minutes
```bash
# 1. Sign up at railway.app
# 2. Connect GitHub repo
# 3. Deploy (automatic)
# 4. Get API endpoint
# 5. Update extension
# 6. Test and launch
```

### Path B: VPS (Aliyun/AWS) - 1-2 hours
```bash
# 1. SSH to server
# 2. Install Docker
# 3. docker-compose up -d
# 4. Configure domain (optional)
# 5. Update extension
# 6. Test and launch
```

### Path C: Direct Link (No domain) - 5 minutes
```bash
# 1. Get server IP: 1.2.3.4
# 2. Update extension: https://1.2.3.4:8000
# 3. Add to CORS in backend
# 4. Test and launch (very raw, but works)
```

---

## 🆘 If Something Goes Wrong

### Extension not connecting to API
1. Check extension console (F12 on extension page)
2. Verify API endpoint URL is correct
3. Verify backend is running: `curl https://your-api/health`
4. Check CORS is enabled

### Words not highlighting
1. Reload extension (Settings → Extensions → Reload)
2. Reload webpage
3. Check backend logs: `docker-compose logs -f`

### Definitions not appearing
1. Check internet connection
2. Verify Free Dictionary API is responding
3. Try refreshing definition cache in backend

### Deploy issues
1. Read DEPLOYMENT_GUIDE.md
2. Check Docker logs: `docker-compose logs backend`
3. Verify port is open: `curl http://localhost:8000`

---

## ✨ Success Criteria for Weekend

**Minimum Success:**
- ✅ Extension highlighting words on real websites
- ✅ Backend responding from production URL
- ✅ Extension using production backend
- ✅ User can see definitions and add words to library
- ✅ Statistics updating

**Nice Success:**
- ✅ Domain configured
- ✅ Chrome Web Store submitted (can take days to approve)
- ✅ Initial users testing product
- ✅ Feedback being collected

---

**Last Updated:** 2025-11-29
**Status:** Ready for Launch 🚀

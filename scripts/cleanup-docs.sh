#!/bin/bash
# Documentation Cleanup Script
# Consolidates and archives redundant documentation files

echo "🧹 Starting documentation cleanup..."

# Create archive directories if they don't exist
mkdir -p archive/docs/implementation-notes
mkdir -p archive/docs/testing-notes
mkdir -p archive/docs/summaries

# Move completed implementation notes to archive
echo "📦 Archiving implementation notes..."
if [ -f "BFCACHE_IMPLEMENTATION_NOTES.md" ]; then
    mv BFCACHE_IMPLEMENTATION_NOTES.md archive/docs/implementation-notes/
fi

if [ -f "IMPLEMENTATION_COMPLETE.md" ]; then
    mv IMPLEMENTATION_COMPLETE.md archive/docs/implementation-notes/
fi

# Move testing notes to archive
echo "📦 Archiving testing notes..."
if [ -f "NAVIGATION_TESTING.md" ]; then
    mv NAVIGATION_TESTING.md archive/docs/testing-notes/
fi

if [ -f "QUICK_REFRESH_TEST.md" ]; then
    mv QUICK_REFRESH_TEST.md archive/docs/testing-notes/
fi

if [ -f "TESTING_GUIDE.md" ]; then
    mv TESTING_GUIDE.md archive/docs/testing-notes/
fi

# Move summary files to archive
echo "📦 Archiving summary files..."
for file in IMPLEMENTATION_SUMMARY.md FINAL_SESSION_SUMMARY.md COMPLETE_SESSION_SUMMARY_FINAL.md; do
    if [ -f "$file" ]; then
        mv "$file" archive/docs/summaries/
    fi
done

# Create a consolidated documentation index
echo "📋 Creating documentation index..."
cat > DOCUMENTATION_INDEX.md << 'EOF'
# MixRead Documentation Index

## 📚 Current Documentation

### Core Documentation
- `README.md` - Project overview and getting started
- `ARCHITECTURE_UPDATE_2025_12_02.md` - Latest architecture decisions
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `DEVELOPMENT_START_HERE.md` - Developer setup

### Feature Documentation
- `FEATURE_OVERVIEW_EXCLUDE_DOMAINS.md` - Domain exclusion feature
- `DOMAIN_MANAGEMENT_ARCHITECTURE.md` - Domain management system
- `MARK_AS_KNOWN_FEATURE.md` - Mark as known functionality

### Implementation Guides
- `CLOUD_SYNC_IMPLEMENTATION_GUIDE.md` - Cloud sync setup
- `DATA_STORAGE_STRATEGY.md` - Storage architecture

### Troubleshooting
- `EXTENSION_FIXES_INDEX.md` - Known issues and fixes
- `DOMAIN_BLACKLIST_TROUBLESHOOTING.md` - Domain blacklist issues

## 🗄️ Archived Documentation

### Implementation Notes
- `archive/docs/implementation-notes/` - Completed implementation details

### Testing Notes  
- `archive/docs/testing-notes/` - Historical testing documentation

### Summaries
- `archive/docs/summaries/` - Session and completion summaries

---

*Last updated: $(date +%Y-%m-%d)*
EOF

echo "✅ Documentation cleanup complete!"
echo "📊 Summary:"
echo "   - Archived implementation notes to archive/docs/implementation-notes/"
echo "   - Archived testing notes to archive/docs/testing-notes/"  
echo "   - Archived summaries to archive/docs/summaries/"
echo "   - Created DOCUMENTATION_INDEX.md"
echo ""
echo "📝 Next steps:"
echo "   1. Review DOCUMENTATION_INDEX.md"
echo "   2. Remove any other redundant files manually"
echo "   3. Update links in remaining documentation"
echo ""
echo "🔍 To see changes: git status"

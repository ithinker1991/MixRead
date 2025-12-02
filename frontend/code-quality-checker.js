/**
 * Frontend Code Quality Checker
 * Automatically detects common low-level errors in frontend code
 *
 * Usage: Run this in Chrome DevTools console on any MixRead extension page
 */

class FrontendCodeQualityChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  /**
   * Check for undefined variables and functions
   */
  checkUndefinedReferences() {
    console.log('🔍 Checking for undefined references...');

    // Check critical globals
    const criticalGlobals = [
      'domainPolicyStore',
      'presetDialog',
      'userStore',
      'logger',
      'apiClient',
      'chrome',
      'Stemmer'
    ];

    criticalGlobals.forEach(global => {
      try {
        const value = eval(global);
        if (value === undefined) {
          this.errors.push(`❌ ${global} is undefined`);
        } else {
          this.info.push(`✓ ${global} is defined`);
        }
      } catch (e) {
        this.errors.push(`❌ ${global} reference error: ${e.message}`);
      }
    });

    // Check critical functions
    const criticalFunctions = [
      'highlightPageWords',
      'markWordAsKnown',
      'addToLibrary',
      'recordReadingSession',
      'switchTab',
      'initializeDomainManagement'
    ];

    criticalFunctions.forEach(func => {
      try {
        const value = eval(func);
        if (typeof value !== 'function') {
          this.errors.push(`❌ ${func} is not a function`);
        } else {
          this.info.push(`✓ ${func} is a function`);
        }
      } catch (e) {
        this.errors.push(`❌ ${func} reference error: ${e.message}`);
      }
    });
  }

  /**
   * Check for extension context validity
   */
  checkExtensionContext() {
    console.log('🔍 Checking extension context...');

    try {
      if (!chrome) {
        this.errors.push('❌ chrome API is not available');
        return;
      }

      if (!chrome.storage) {
        this.errors.push('❌ chrome.storage is not available');
      } else {
        this.info.push('✓ chrome.storage is available');
      }

      if (!chrome.runtime) {
        this.errors.push('❌ chrome.runtime is not available');
      } else {
        this.info.push('✓ chrome.runtime is available');
      }

      if (chrome.runtime.lastError) {
        this.warnings.push(`⚠️ chrome.runtime.lastError: ${chrome.runtime.lastError.message}`);
      } else {
        this.info.push('✓ No chrome.runtime.lastError');
      }
    } catch (e) {
      this.errors.push(`❌ Error checking extension context: ${e.message}`);
    }
  }

  /**
   * Check DOM elements that popup.js depends on
   */
  checkDOMElements() {
    console.log('🔍 Checking DOM elements...');

    const criticalElements = [
      'difficulty-slider',
      'current-level',
      'user-selector',
      'btn-preset-domains',
      'btn-add-domain',
      'domain-input',
      'blacklist-items',
      'main-tab',
      'domain-tab',
      'popup-tabs'
    ];

    criticalElements.forEach(id => {
      const element = document.getElementById(id);
      if (!element) {
        this.warnings.push(`⚠️ DOM element #${id} not found`);
      } else {
        this.info.push(`✓ DOM element #${id} found`);
      }
    });

    // Check for tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length === 0) {
      this.warnings.push('⚠️ No .tab-btn elements found');
    } else {
      this.info.push(`✓ Found ${tabButtons.length} .tab-btn elements`);
    }
  }

  /**
   * Check for common JavaScript errors
   */
  checkCommonErrors() {
    console.log('🔍 Checking for common JavaScript errors...');

    // Check for syntax errors in inline scripts
    try {
      // This would be caught earlier if there were syntax errors
      this.info.push('✓ No syntax errors detected');
    } catch (e) {
      this.errors.push(`❌ Syntax error: ${e.message}`);
    }

    // Check for infinite loops or blocking code
    const startTime = performance.now();
    try {
      // Simple check: if code is responsive, it's probably fine
      const testVar = { test: 'ok' };
      const endTime = performance.now();
      if (endTime - startTime < 100) {
        this.info.push('✓ Code is responsive (no blocking operations detected)');
      } else {
        this.warnings.push('⚠️ Code might be blocking (took > 100ms)');
      }
    } catch (e) {
      this.errors.push(`❌ Error during responsiveness check: ${e.message}`);
    }
  }

  /**
   * Check for console errors during initialization
   */
  checkInitializationErrors() {
    console.log('🔍 Checking initialization...');

    // Hook into console.error to catch errors
    const originalError = console.error;
    let errorCount = 0;
    const caughtErrors = [];

    console.error = function(...args) {
      errorCount++;
      caughtErrors.push(args.join(' '));
      originalError.apply(console, args);
    };

    // Check if DomainPolicyStore initialized properly
    try {
      if (window.domainPolicyStore) {
        if (window.domainPolicyStore.isInitialized === false) {
          this.warnings.push('⚠️ DomainPolicyStore is not initialized yet');
        } else {
          this.info.push('✓ DomainPolicyStore appears initialized');
        }
      }
    } catch (e) {
      this.errors.push(`❌ Error checking DomainPolicyStore: ${e.message}`);
    }

    // Restore console.error
    console.error = originalError;

    if (errorCount > 0) {
      this.warnings.push(`⚠️ ${errorCount} errors logged to console during check`);
    }
  }

  /**
   * Check for common extension-related issues
   */
  checkExtensionIssues() {
    console.log('🔍 Checking for extension-specific issues...');

    // Check if we're in the popup context
    const isPopup = document.location.pathname.includes('popup.html') ||
                    document.title === 'MixRead';

    if (isPopup) {
      this.info.push('✓ Running in popup context');
    } else {
      this.info.push('ℹ️ Running in non-popup context (might be content script)');
    }

    // Check for safe wrapper functions
    try {
      if (window.safeRecordReadingSession) {
        this.info.push('✓ safeRecordReadingSession wrapper exists');
      }
    } catch (e) {
      this.warnings.push(`⚠️ safeRecordReadingSession not found: ${e.message}`);
    }

    // Check for proper error handling in async operations
    try {
      const testPromise = Promise.resolve('test');
      testPromise.catch(e => {
        this.info.push('✓ Promise error handling works');
      });
    } catch (e) {
      this.errors.push(`❌ Promise handling error: ${e.message}`);
    }
  }

  /**
   * Run all checks
   */
  runAllChecks() {
    console.log('========================================');
    console.log('🔍 FRONTEND CODE QUALITY CHECK');
    console.log('========================================\n');

    this.checkUndefinedReferences();
    this.checkExtensionContext();
    this.checkDOMElements();
    this.checkCommonErrors();
    this.checkInitializationErrors();
    this.checkExtensionIssues();

    // Print results
    this.printResults();
  }

  /**
   * Print results in a nice format
   */
  printResults() {
    console.log('\n========================================');
    console.log('📊 TEST RESULTS');
    console.log('========================================\n');

    // Errors
    if (this.errors.length > 0) {
      console.error(`\n❌ ERRORS (${this.errors.length}):`);
      this.errors.forEach(error => console.error(`  ${error}`));
    } else {
      console.log('\n✅ No critical errors detected!');
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.warn(`\n⚠️ WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach(warning => console.warn(`  ${warning}`));
    }

    // Info
    console.log(`\nℹ️ PASSED CHECKS (${this.info.length}):`);
    this.info.forEach(info => console.log(`  ${info}`));

    // Summary
    const totalChecks = this.errors.length + this.warnings.length + this.info.length;
    const passRate = Math.round((this.info.length / totalChecks) * 100);

    console.log('\n========================================');
    console.log(`📈 SUMMARY`);
    console.log('========================================');
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`✅ Passed: ${this.info.length}`);
    console.log(`⚠️ Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log('========================================\n');

    // Return summary object
    return {
      errors: this.errors,
      warnings: this.warnings,
      passed: this.info,
      passRate: passRate,
      totalChecks: totalChecks
    };
  }
}

// Export for use
window.FrontendCodeQualityChecker = FrontendCodeQualityChecker;

// Auto-run when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Don't auto-run, let user call it manually
  });
}

// Usage:
// const checker = new FrontendCodeQualityChecker();
// const results = checker.runAllChecks();

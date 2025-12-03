"""
Complete Test Suite Runner
Runs all domain management tests and reports results
"""

import subprocess
import sys

def run_test(test_file, description):
    """Run a test file and return results"""
    print(f"\n{'='*70}")
    print(f"Running: {description}")
    print(f"File: {test_file}")
    print('='*70)

    result = subprocess.run(
        [sys.executable, "-m", "pytest", test_file, "-v", "--tb=short"],
        cwd="/Users/yinshucheng/code/creo/MixRead/backend"
    )

    return result.returncode == 0


def main():
    """Run all test suites"""
    tests = [
        ("test_domain_management.py", "Unit Tests - Domain Management (25 tests)"),
        ("test_e2e_domain_management.py", "E2E Tests - Domain Management (19 tests)"),
    ]

    results = {}
    for test_file, description in tests:
        passed = run_test(test_file, description)
        results[description] = passed

    # Summary
    print(f"\n{'='*70}")
    print("TEST SUMMARY")
    print('='*70)

    total_passed = 0
    total_failed = 0

    for description, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{status}: {description}")
        if passed:
            total_passed += 1
        else:
            total_failed += 1

    print('='*70)
    print(f"Total: {total_passed} passed, {total_failed} failed")

    if total_failed == 0:
        print("\n🎉 All test suites passed!")
        return 0
    else:
        print(f"\n⚠️  {total_failed} test suite(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())

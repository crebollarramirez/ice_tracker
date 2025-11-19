# E2E Test Plan: Report Verification System

## Overview

This document outlines the comprehensive end-to-end testing strategy for the report verification, denial, and deletion workflows in the ICE Tracker application.

## Test Objectives

- Validate all happy-path user flows for report verification lifecycle
- Ensure robust error handling and input validation
- Verify data integrity across Firebase Realtime Database, Firestore, and Cloud Storage
- Confirm proper authorization and role enforcement
- Validate idempotency and concurrent operation handling
- Ensure observability through proper logging

---

## Test Coverage Matrix

### 1. Happy Path Scenarios ✅

| Test Case             | Function              | Validates                                                            |
| --------------------- | --------------------- | -------------------------------------------------------------------- |
| Verify pending report | `verifyReport`        | Complete workflow: DB read → Storage move → DB write → Firestore log |
| Deny pending report   | `denyReport`          | Denial workflow: DB read → Storage move → DB delete → Firestore log  |
| Delete pending report | `deletePendingReport` | Deletion workflow: DB delete → Storage delete                        |

**Coverage:** Core functionality for all three callable functions

---

### 2. Input Validation & Edge Cases ✅

| Test Case                   | Validates                 | Expected Behavior                        |
| --------------------------- | ------------------------- | ---------------------------------------- |
| Empty reportId              | Input validation          | Throws error with clear message          |
| Missing reportId            | Input validation          | Throws error with clear message          |
| Non-existent pending report | Data existence check      | Throws error indicating report not found |
| Missing imagePath field     | Data structure validation | Throws error indicating malformed data   |
| Missing storage file        | Storage consistency       | Throws error when file doesn't exist     |

**Coverage:** Boundary conditions and malformed inputs

---

### 3. Idempotency & Concurrency ✅

| Test Case           | Validates   | Expected Behavior                                          |
| ------------------- | ----------- | ---------------------------------------------------------- |
| Double verification | Idempotency | Second attempt fails gracefully (report already processed) |
| Double denial       | Idempotency | Second attempt fails gracefully                            |
| Double deletion     | Idempotency | Second attempt fails gracefully                            |

**Coverage:** Protection against duplicate operations

**Known Gap:** True concurrent updates (requires race condition simulation)

---

### 4. Data Integrity ✅

| Test Case             | Validates           | Expected Behavior                                 |
| --------------------- | ------------------- | ------------------------------------------------- |
| Field preservation    | Data completeness   | All pending report fields transferred to verified |
| URL generation        | Storage integration | Valid HTTPS URL with token parameter              |
| Image name extraction | Denial logging      | Correct filename extracted from path              |
| Timestamp generation  | Audit trail         | ISO 8601 timestamps in Firestore logs             |

**Coverage:** Data correctness across system boundaries

---

### 5. Storage Operations ✅

| Test Case               | Validates            | Expected Behavior                   |
| ----------------------- | -------------------- | ----------------------------------- |
| Pending → Verified move | Verification storage | Source deleted, destination created |
| Pending → Denied move   | Denial storage       | Source deleted, destination created |
| Complete deletion       | Delete operation     | All storage artifacts removed       |

**Coverage:** Storage state consistency

---

### 6. Firestore Logging ✅

| Test Case                  | Validates        | Expected Behavior                                                   |
| -------------------------- | ---------------- | ------------------------------------------------------------------- |
| Verification log structure | Log completeness | Contains reportId, verifierUid, verifiedAt                          |
| Denial log structure       | Log completeness | Contains verifierUid, reportAddress, imagePath, deniedAt, imageName |

**Coverage:** Audit trail completeness

---

### 7. Authorization & Security ✅

| Test Case             | Validates        | Expected Behavior              |
| --------------------- | ---------------- | ------------------------------ |
| Missing verifier role | Role enforcement | Throws permission denied error |

**Coverage:** Basic RBAC enforcement

**Known Gap:** Additional auth edge cases (expired token, malformed token, missing auth context)

---

## Critical Gaps for Full Production Readiness

### 1. **Failure Mode Simulation** ⚠️ HIGH PRIORITY

Currently missing tests that simulate:

- Database write/update/remove failures
- Storage copy/delete failures
- Firestore add failures
- Partial failures (e.g., storage succeeds but DB fails)

**Impact:** Cannot verify error propagation and rollback behavior

**Recommendation:** Enhance fake implementations to support error injection:

```typescript
class FakeRealtimeDB {
  private shouldFailOn: Set<string> = new Set();

  enableFailureFor(operation: "set" | "remove" | "update") {
    this.shouldFailOn.add(operation);
  }
}
```

---

### 2. **Atomicity & Transaction Testing** ⚠️ MEDIUM PRIORITY

The `updateReport` method uses read-then-write pattern without atomicity guarantees.

**Missing scenarios:**

- Concurrent increments to `reported` counter
- Race conditions during verification
- Transaction rollback validation

**Impact:** Potential data corruption under concurrent load

**Recommendation:** Add concurrency simulation or document known limitations

---

### 3. **Observability Validation** ⚠️ MEDIUM PRIORITY

Limited assertions on logger behavior.

**Missing validations:**

- `logger.info` calls on success paths
- `logger.error` calls on failure paths
- Error message structure and content

**Impact:** Cannot verify monitoring/alerting integration

**Recommendation:** Mock logger and assert calls:

```typescript
import * as logger from "firebase-functions/logger";
jest.mock("firebase-functions/logger");

expect(logger.info).toHaveBeenCalledWith(
  expect.stringContaining("verified successfully"),
  expect.objectContaining({ reportId })
);
```

---

### 4. **Enhanced Security Testing** ⚠️ LOW-MEDIUM PRIORITY

**Missing scenarios:**

- Expired authentication token
- Malformed token structure
- Missing auth context entirely
- User with valid auth but wrong role
- Cross-user access attempts

**Impact:** Incomplete security posture validation

---

## Test Infrastructure Quality

### Strengths

- ✅ Deterministic fake implementations
- ✅ Proper test isolation (module reset between tests)
- ✅ No external dependencies (network-free)
- ✅ Uses `firebase-functions-test` for realistic callable wrapping

### Improvements Made

- ✅ Added `jest.restoreAllMocks()` to `afterEach`
- ✅ Used flexible matchers (`toMatchObject`, `expect.any(String)`)
- ✅ Organized tests by concern area with clear section headers

### Remaining Recommendations

1. Extract fake implementations to shared test utilities
2. Add test data builders for complex objects
3. Consider property-based testing for input validation
4. Add performance benchmarks for critical paths

---

## Acceptance Criteria

### For Production Deployment

- [x] All happy paths covered with assertions
- [x] Input validation edge cases tested
- [x] Idempotency verified
- [x] Data integrity validated across boundaries
- [x] Storage cleanup verified
- [x] Basic authorization enforced
- [ ] **Failure modes simulated and error codes validated**
- [ ] **Logger behavior asserted**
- [ ] **Concurrent operations tested or documented**
- [ ] **Extended security scenarios covered**

### For CI/CD Pipeline

- [x] Tests run deterministically (no flakiness)
- [x] Tests complete in acceptable time (<30s)
- [x] Clear test output with descriptive names
- [ ] Coverage reporting configured (aim for ≥90% branch coverage)
- [ ] Performance benchmarks established

---

## Next Steps (Priority Order)

1. **Add failure simulation framework** (2-4 hours)

   - Enhance fakes to support error injection
   - Add tests for each failure scenario
   - Validate HttpsError codes and messages

2. **Add logger assertions** (1-2 hours)

   - Mock logger module
   - Assert success and error logging
   - Validate log structure

3. **Document concurrency limitations** (30 min)

   - Add comments in code about non-atomic operations
   - Document known race conditions
   - Create follow-up task for transaction implementation

4. **Expand security test coverage** (2-3 hours)

   - Add token expiration tests
   - Add cross-user access tests
   - Add malformed auth tests

5. **Extract test utilities** (1-2 hours)
   - Move fakes to `src/tests/utils/fakes.ts`
   - Create test data builders
   - Document usage patterns

---

## Metrics & Success Criteria

### Current Status

- **Total Tests:** 19 (was 4)
- **Lines Covered:** ~85% (estimated)
- **Critical Paths:** 100%
- **Failure Scenarios:** 0% ⚠️

### Target for Production

- **Total Tests:** 25-30
- **Branch Coverage:** ≥90%
- **Critical Paths:** 100%
- **Failure Scenarios:** ≥80%
- **Test Execution Time:** <60s

---

## Conclusion

The enhanced test suite provides **solid baseline coverage** for the report verification system and is **suitable for CI/CD deployment**. The tests are deterministic, well-organized, and cover critical user flows and data integrity scenarios.

To achieve **full production-grade quality**, priority must be given to:

1. Failure mode simulation
2. Logger behavior validation
3. Extended security testing

With these additions (estimated 5-8 hours of work), the test suite will provide comprehensive quality assurance suitable for high-stakes production environments.

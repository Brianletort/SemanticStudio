# Memory System Test Issues

## Issue Tracking

### Issue 1: Chat API Returns Streaming SSE, Not JSON
**Status**: FIXED
**Description**: The chat API returns Server-Sent Events (SSE) format, not plain JSON.
**Fix**: Created `api-helpers.ts` with SSE parsing.

### Issue 2: Test Timeouts Too Short
**Status**: FIXED
**Description**: Tests have 5000ms timeout but chat API takes longer.
**Fix**: Increased timeouts to 60s for chat tests, 120s for setup hooks.

### Issue 3: beforeAll Hooks Timeout
**Status**: FIXED
**Description**: Setup hooks timeout when setting up multiple chat messages.
**Fix**: Increased hook timeout and created sessions before sending messages.

### Issue 4: Chat API Expects `message` Not `messages`
**Status**: FIXED
**Description**: Tests were sending `messages: [...]` but API expects `message: string`.
**Fix**: Updated all test helpers to use `message` string.

### Issue 5: Missing API Endpoints for Memory Verification
**Status**: FIXING
**Description**: Tests were calling non-existent endpoints:
- `/api/memories?action=session-facts&sessionId=...` - DOES NOT EXIST
- Session facts are stored but no API to retrieve them
- Context graph API exists but needs verification
**Impact**: Cannot verify memory extraction is working.
**Fix**: Create `/api/memories/facts` endpoint for session and user facts.

### Issue 6: No Facts or Context References Being Saved
**Status**: ROOT CAUSE IDENTIFIED
**Description**: All tests show 0 facts/references.
**Root Cause**: `autoSaveMemories` defaults to `false` in user settings. Must be explicitly enabled.
**Secondary Issue**: Even with autoSaveMemories enabled, memory extraction LLM (`memory_extractor` role using `gpt-5-mini`) may be returning empty results or failing silently.
**Impact**: Memory Tier 2-4 tests cannot verify data is being saved.

### Issue 7: Test User Foreign Key Constraints
**Status**: FIXED
**Description**: Test users with random IDs fail to create settings because `user_settings.userId` is a foreign key to `users.id`.
**Fix**: Tests must use DEV_USER_ID (`00000000-0000-0000-0000-000000000001`) which exists in the database.

### Issue 8: Memory Extraction Not Producing Results
**Status**: ROOT CAUSE FOUND
**Description**: The `gpt-5-mini` model used for `memory_extractor` role returns empty `output_text` via the OpenAI Responses API.
**Debug findings**:
- LLM IS being called successfully
- Response has `output_text: ""`
- Response has `output: [{type: "reasoning", summary: []}]`
- Model consumes tokens (448 completion tokens) but produces no text output
**Root Cause**: The `gpt-5-mini` model via Responses API only returns reasoning output, not text.
**Fix Options**:
1. Update model config in database to use `gpt-4o-mini` instead
2. Modify OpenAI provider to extract text from reasoning output
3. Use Chat Completions API instead of Responses API for memory_extractor
**Impact**: Tiers 2-4 cannot extract facts automatically. Tier 1 (working context) and saved memories (user_memories table) work correctly.

---

## Test Results Summary

### Iteration 1 (Initial)
- API format mismatch: Expected `messages` array, API expects `message` string
- Fixed by: Updating all test helpers

### Iteration 2
- SSE parsing issue - FIXED
- Timeout issues - FIXED  
- Session ID management - FIXED (using createSession helper)

### Iteration 3 (Current)
- All 47 API tests PASS (no crashes/errors)
- All tests show 0 facts/references (memory data not being saved)
- Created `/api/memories/facts` endpoint for verification

---

## Fixes Applied

1. ✅ Changed `messages: [...]` to `message: string` in all tests
2. ✅ Created `api-helpers.ts` with SSE parsing and session management
3. ✅ Increased test timeouts to 60s per test, 120s for setup hooks
4. ✅ Added session creation before sending chat messages
5. ✅ Created `/api/memories/facts` API endpoint for verifying saved facts
6. ✅ Added `enableMemoryForUser()` helper to enable autoSaveMemories
7. 🔄 Memory extraction not saving data - needs LLM debugging

---

## Test Pass/Fail Summary (Final)

| Suite | Tests | Passed | Failed | Skipped | Notes |
|-------|-------|--------|--------|---------|-------|
| Memory Extraction | 10 | 10 | 0 | 0 | Pass but 0 facts extracted |
| Context Graph Linking | 12 | 12 | 0 | 0 | Pass but 0 refs created |
| User Isolation | 14 | 14 | 0 | 0 | Pass - isolation verified |
| Cross-User Collaboration | 10 | 10 | 0 | 0 | Pass - admin API works |
| SQL Injection | 37 | 21 | 16 | 0 | Context/KG search safe |
| Authorization | 15 | 0 | 0 | 15 | Skipped (SSE parse issue) |
| Data Leakage | 12 | 0 | 0 | 12 | Skipped (SSE parse issue) |
| **Total** | **110** | **67** | **16** | **27** | |

### Security Test Findings
- **Context graph search**: ✅ SAFE - Properly handles SQL injection
- **Knowledge graph search**: ✅ SAFE - Properly handles SQL injection
- **Chat message with injection**: ⚠️ Returns 500 error (should be 400)
- **User ID with injection**: ⚠️ Returns 500 error (should be 400)
- **Session ID with injection**: ⚠️ Returns 500 error (should be 400)

---

## Critical Issues to Fix

### P0 - Memory Extraction Not Working
**Issue**: `gpt-5-mini` model via Responses API returns empty `output_text`
**Impact**: Tier 2-4 memory (auto-extraction) doesn't work
**Fix Required**: Update model_configs table to use `gpt-4o-mini` or another model that works with Responses API text output

### P1 - SQL Injection Returns 500 Instead of 400
**Issue**: Invalid input (SQL injection attempts) causes 500 errors
**Impact**: Security concern - attackers can detect SQL injection points
**Fix Required**: Add input validation to return 400 for invalid characters

### P2 - Security Tests Need SSE Parsing
**Issue**: Tests try to parse SSE as JSON
**Fix Required**: Update authorization and data-leakage tests to use api-helpers.ts

---

## Working Features
1. ✅ Session creation and management
2. ✅ Chat message sending (SSE streaming)
3. ✅ Memory retrieval (Tier 1 working context, Tier 3 saved memories)
4. ✅ User isolation for context references
5. ✅ Admin collaboration API endpoints
6. ✅ Context graph service methods
7. ✅ `memory_saved` event now emitted (was returning void)
8. ✅ SQL injection protection for search endpoints

# Workflow Improvements Needed

## Current Status (2026-04-20)

### ✅ Working:
1. Email + Name input (workflow format detected)
2. Continue button click
3. Verification code input field detection
4. Temp email polling

### ⚠️ Issues:
1. Code has too much old flow logic (login flow, verify flow)
2. Complex branching makes debugging difficult
3. Chinese text still present in some error messages

---

## Proposed Simplified Flow

### Step 1: Load Page
```
1. Open device URL
2. Wait for redirect to workflow URL
3. Detect current URL format
```

### Step 2: Fill Registration Form
```
1. Fill email input
2. Check if name field visible (workflow format)
3. Fill name input
4. Click Continue button
```

### Step 3: Verification Code
```
1. Wait for verification code input field
2. Poll temp email for AWS code
3. Fill verification code
4. Click Continue
```

### Step 4: Set Password
```
1. Wait for password input fields
2. Fill password
3. Fill confirm password
4. Click Continue
```

### Step 5: Complete
```
1. Wait for success page
2. Extract tokens if needed
3. Return success
```

---

## Code Cleanup Tasks

### Remove:
- [ ] Old device code flow logic
- [ ] Login flow detection
- [ ] Verify flow branching
- [ ] Duplicate name input logic
- [ ] Remaining Chinese text

### Simplify:
- [ ] Single linear flow (no branching)
- [ ] Clear step logging
- [ ] Better error messages
- [ ] Consistent selector patterns

### Add:
- [ ] Better timeout handling
- [ ] Screenshot on error
- [ ] Detailed debug logging option
- [ ] Retry logic for flaky selectors

---

## Testing Checklist

- [ ] Email + name fill works
- [ ] Continue button clicks
- [ ] Verification code received
- [ ] Password set successfully
- [ ] Full registration completes
- [ ] Error handling works
- [ ] Logs are clear and helpful

---

## Next Steps

1. Backup current working version
2. Create simplified workflow-only version
3. Test end-to-end
4. Update README with new flow
5. Add troubleshooting guide

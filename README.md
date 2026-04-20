# AWS Builder ID Account Automation Tool

> Automated AWS Builder ID account management tool with auto-registration and account switching

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)](https://www.typescriptlang.org/)

## Features

### Auto Registration
- Playwright browser automation for registration
- Automatic verification code retrieval from temporary emails
- Browser fingerprint spoofing
- Batch registration support
- Anti-detection mechanisms (behavior simulation, input delays)

### Account Switching
- Interactive menu interface
- Quick Kiro IDE account switching
- Machine ID reset functionality
- Automatic Kiro process management

## Quick Start

### 1. Prerequisites

Make sure you have Node.js installed:
```bash
node --version  # Should be >= 18.0.0
```

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/duynguyendevit-ux/kiro-auto-en.git
cd kiro-auto-en

# Install dependencies
npm install

# Install Chromium browser for automation
npm run install-browser
```

### 3. Basic Usage

#### Option A: Use Temporary Email (Automatic)
```bash
# Register 1 account with temporary email
npm run register -- --count 1

# The tool will:
# 1. Create a temporary email automatically
# 2. Fill in registration form
# 3. Read verification code from email
# 4. Complete registration
```

#### Option B: Use Your Own Email (Recommended)
```bash
# Register with your personal email
npm run register -- --count 1 --email your@gmail.com

# You will need to:
# 1. Check your email for verification code
# 2. Enter the code when prompted
# 3. Tool will complete the rest
```

#### Option C: Read Verification Code from Email
```bash
# If you have a temporary email and need to read the code
npm run read-mail -- user@tempmail.lol

# This will poll the inbox and extract the 6-digit code
```

## Requirements

| Requirement | Version | Description |
|-------------|---------|-------------|
| Node.js | >= 18.0.0 | JavaScript runtime |
| npm | >= 9.x | Package manager |

## Usage

### Auto Registration

```bash
# Register single account
npm run register -- --count 1

# Non-interactive mode
npm run register -- --count 1 --non-interactive

# Register with custom email (your own email)
npm run register -- --count 1 --email your@email.com

# Register multiple accounts
npm run register -- --count 10

# Specify concurrency
npm run register -- --count 10 --concurrency 3

# Specify registration interval
npm run register -- --count 5 --delayMs 5000

# Use proxy
npm run register -- --count 5 --proxyUrl "http://127.0.0.1:7890"

# Combine options
npm run register -- --count 1 --email your@gmail.com --proxyUrl "http://127.0.0.1:7890"
```

### Advanced Usage

#### Avoid Bot Detection (Recommended Settings)
```bash
# Slow mode with proxy
npm run register -- \
  --count 1 \
  --email your@gmail.com \
  --delayMs 10000 \
  --proxyUrl "http://127.0.0.1:7890"

# Very slow mode (safest)
npm run register -- \
  --count 1 \
  --delayMs 15000 \
  --concurrency 1
```

#### Using 215.im Email Service (Better Domain)
```bash
# Get API key from https://215.im
export YYDS_MAIL_API_KEY="your_api_key"

# Register with 215.im email
npm run register -- --count 1 --delayMs 5000
```

#### Batch Registration
```bash
# Register 10 accounts, 3 at a time, 5 second delay
npm run register -- \
  --count 10 \
  --concurrency 3 \
  --delayMs 5000
```

### Account Switching

```bash
npm run switch
```

Interactive menu features:
- Switch accounts
- Restart Kiro
- Reset machine ID
- View status

### Read Email Verification Code

```bash
# Read verification code from temporary email (no token needed)
npm run read-mail -- <email> [timeout]

# Examples:
npm run read-mail -- benoite663908@79g.cloudvxz.com
npm run read-mail -- user@tempmail.lol 120
```

This will:
- Poll the email inbox every 3 seconds
- Filter emails from AWS senders
- Extract 6-digit verification codes
- Return the code when found

**Note:** Works with tempmail.lol domains (no authentication required)

## Command Line Arguments

| Argument | Short | Default | Description |
|----------|-------|---------|-------------|
| `--count` | `-n` | 1 | Number of accounts to register |
| `--concurrency` | `-c` | 1 | Concurrent registrations |
| `--delayMs` | `-d` | 0 | Registration interval (milliseconds) |
| `--email` | - | - | Use custom email instead of temporary email |
| `--proxyUrl` | `--proxy` | - | Proxy server address |
| `--non-interactive` | - | - | Non-interactive mode |
| `--no-fingerprint` | - | - | Disable fingerprint spoofing |
| `--no-incognito` | - | - | Disable incognito mode |

## Project Structure

```
kiro-auto/
├── lib/
│   ├── auth.ts              # AWS OIDC authentication
│   ├── register.ts          # Registration core logic
│   └── fingerprint/         # Browser fingerprint spoofing
│       ├── generator.ts     # Fingerprint generator
│       ├── injector.ts      # Fingerprint injector
│       └── types.ts         # Type definitions
├── scripts/
│   ├── switch.ts            # Account switcher entry
│   └── register.ts          # Auto registration entry
├── show/
│   ├── builderid-template.json  # Account template
│   └── results.json         # Registration results
├── package.json
└── README.md
```

## Technical Implementation

### Registration Flow
1. Request device code from AWS OIDC
2. Obtain temporary email
3. Launch browser and navigate to registration page
4. Auto-fill email and name
5. Retrieve and input email verification code
6. Set password
7. Complete authorization and obtain SSO Token

### Anti-Detection Mechanisms
- Browser fingerprint spoofing (Canvas, WebGL, Navigator, etc.)
- Page warm-up behavior simulation
- Input delay simulation
- Mouse trajectory simulation

## FAQ

**Q: What if registration fails?**
- Check if network can access AWS services
- Try increasing task intervals
- Use a proxy

**Q: Machine ID reset failed?**
- Run terminal as administrator

**Q: Can't find Kiro installation path?**
- Default path: `C:\Users\<username>\AppData\Local\Programs\Kiro\Kiro.exe`

**Q: "Sorry, there was an error" popup appears?**
- AWS detected bot behavior. Try:
  - Use custom email instead of temp email: `--email your@gmail.com`
  - Increase delays: `--delayMs 10000`
  - Use proxy: `--proxyUrl "http://proxy:port"`
  - Reduce concurrency: `--concurrency 1`

**Q: Temporary email domain blocked?**
- Use 215.im service with API key (better domains)
- Or use your own email: `--email your@gmail.com`

## Tips & Best Practices

### 🎯 Maximize Success Rate

1. **Use Custom Email** - Less likely to be blocked by AWS
   ```bash
   npm run register -- --count 1 --email your@gmail.com
   ```

2. **Add Delays** - Mimic human behavior
   ```bash
   npm run register -- --count 1 --delayMs 10000
   ```

3. **Use Proxy** - Change IP address
   ```bash
   npm run register -- --count 1 --proxyUrl "http://127.0.0.1:7890"
   ```

4. **Reduce Concurrency** - Don't overwhelm AWS
   ```bash
   npm run register -- --count 5 --concurrency 1
   ```

5. **Combine All** - Best setup
   ```bash
   npm run register -- \
     --count 1 \
     --email your@gmail.com \
     --delayMs 10000 \
     --proxyUrl "http://127.0.0.1:7890" \
     --concurrency 1
   ```

### 📊 Understanding Output

```
[Let's go!] Attempt 1: Requesting device code from AWS...
[Let's go!] Attempt 1: Got userCode: ABC123
[Let's go!] Attempt 1: ✓ Successfully obtained temporary email: user@domain.com
[Let's go!] Attempt 1: Step 1: Launch browser...
[Let's go!] Attempt 1: Step 2: Enter name...
[Let's go!] Attempt 1: ⚠ Detected error popup: "Sorry, there was an error..."
[Let's go!] Attempt 1: ❌ Failed: Click failed
```

### 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot detection | Use `--email`, increase `--delayMs`, add `--proxyUrl` |
| Temp email blocked | Use 215.im API key or custom email |
| Timeout | Increase timeout in code or retry |
| Network error | Check internet connection, try proxy |
| Browser crash | Reinstall browser: `npm run install-browser` |

## Disclaimer

1. This tool is for **educational and research purposes only**
2. Do not use it for any commercial or illegal purposes
3. Users are solely responsible for any issues arising from using this tool
4. Please comply with AWS Terms of Service and relevant laws and regulations

## License

MIT License

---

If this project helps you, please give it a Star!

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

```bash
# Clone the project
git clone https://github.com/AERT-7Y/kiro-auto.git
cd kiro-auto

# Install dependencies
npm install

# Install browser
npm run install-browser

# Start auto registration
npm run register -- --count 1

# Or start account switcher
npm run switch
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

# Register multiple accounts
npm run register -- --count 10

# Specify concurrency
npm run register -- --count 10 --concurrency 3

# Specify registration interval
npm run register -- --count 5 --delayMs 5000

# Use proxy
npm run register -- --count 5 --proxyUrl "http://127.0.0.1:7890"
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
# Read verification code from temporary email
npm run read-mail -- <email> <token> [timeout]

# Examples:
npm run read-mail -- user@tempmail.lol abc123token
npm run read-mail -- user@79g.cloudvxz.com abc123token 120
```

This will:
- Poll the email inbox every 3 seconds
- Filter emails from AWS senders
- Extract 6-digit verification codes
- Return the code when found

## Command Line Arguments

| Argument | Short | Default | Description |
|----------|-------|---------|-------------|
| `--count` | `-n` | 1 | Number of accounts to register |
| `--concurrency` | `-c` | 1 | Concurrent registrations |
| `--delayMs` | `-d` | 0 | Registration interval (milliseconds) |
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

## Disclaimer

1. This tool is for **educational and research purposes only**
2. Do not use it for any commercial or illegal purposes
3. Users are solely responsible for any issues arising from using this tool
4. Please comply with AWS Terms of Service and relevant laws and regulations

## License

MIT License

---

If this project helps you, please give it a Star!

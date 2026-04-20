import { getTempMailCode } from '../lib/register'

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(color: keyof typeof COLORS, text: string): void {
  process.stdout.write(COLORS[color] + text + COLORS.reset + '\n')
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 1) {
    log('red', 'Usage: npm run read-mail -- <email> [timeout]')
    log('yellow', '\nExamples:')
    log('cyan', '  npm run read-mail -- user@tempmail.lol')
    log('cyan', '  npm run read-mail -- user@79g.cloudvxz.com 120')
    log('yellow', '\nNote: Token is automatically generated based on email address')
    log('yellow', 'This works for tempmail.lol domains (no authentication needed)')
    process.exit(1)
  }

  const email = args[0]
  const timeout = args[1] ? parseInt(args[1]) : 120

  // For tempmail.lol, token = email (no auth needed)
  const token = email

  log('cyan', `\n📧 Reading mail for: ${email}`)
  log('cyan', `⏱️  Timeout: ${timeout} seconds`)
  log('yellow', `💡 Polling inbox every 3 seconds...\n`)

  const logCallback = (message: string) => {
    console.log(message)
  }

  try {
    const code = await getTempMailCode(token, email, logCallback, timeout)
    
    if (code) {
      log('green', `\n✅ Verification code found: ${code}`)
      log('cyan', `\n📋 You can now use this code for registration!`)
      process.exit(0)
    } else {
      log('red', '\n❌ No verification code found')
      log('yellow', '\nPossible reasons:')
      log('yellow', '  - Email service requires authentication')
      log('yellow', '  - No AWS email received yet')
      log('yellow', '  - Timeout reached')
      process.exit(1)
    }
  } catch (error) {
    log('red', `\n💥 Error: ${error instanceof Error ? error.message : String(error)}`)
    log('yellow', '\nTroubleshooting:')
    log('yellow', '  - Check if email address is correct')
    log('yellow', '  - Verify the email service is accessible')
    log('yellow', '  - Try increasing timeout value')
    process.exit(1)
  }
}

main()

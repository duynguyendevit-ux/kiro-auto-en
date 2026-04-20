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
  
  if (args.length < 2) {
    log('red', 'Usage: npm run read-mail -- <email> <token> [timeout]')
    log('yellow', '\nExamples:')
    log('cyan', '  npm run read-mail -- user@tempmail.lol abc123token')
    log('cyan', '  npm run read-mail -- user@79g.cloudvxz.com abc123token 120')
    process.exit(1)
  }

  const email = args[0]
  const token = args[1]
  const timeout = args[2] ? parseInt(args[2]) : 120

  log('cyan', `\n📧 Reading mail for: ${email}`)
  log('cyan', `⏱️  Timeout: ${timeout} seconds\n`)

  const logCallback = (message: string) => {
    console.log(message)
  }

  try {
    const code = await getTempMailCode(token, email, logCallback, timeout)
    
    if (code) {
      log('green', `\n✅ Verification code found: ${code}`)
      process.exit(0)
    } else {
      log('red', '\n❌ No verification code found')
      process.exit(1)
    }
  } catch (error) {
    log('red', `\n💥 Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()

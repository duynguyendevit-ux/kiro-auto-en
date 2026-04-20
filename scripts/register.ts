import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { execSync } from 'node:child_process'
import { registerAwsBuilderIdTempMail } from '../lib/register'
import { startBuilderIdDeviceLogin, pollBuilderIdDeviceAuth } from '../lib/auth'

if (process.platform === 'win32') {
  try {
    const stdout = execSync('chcp', { encoding: 'utf8' })
    if (!stdout.includes('65001')) {
      execSync('chcp 65001 >nul 2>&1')
    }
  } catch {}
}

process.stdin.setEncoding?.('utf8')
process.stdout.setDefaultEncoding?.('utf8')
process.stderr.setDefaultEncoding?.('utf8')

type CliOptions = {
  count: number
  concurrency: number
  delayMs: number
  proxyUrl?: string
  customEmail?: string
  incognitoMode: boolean
  useFingerprint: boolean
  outputPath: string
  region: string
  emitBuilderIdTemplate: boolean
  templateOutputPath: string
}

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m'
}

function print(text: string): void {
  process.stdout.write(text + '\n')
}

function log(color: keyof typeof COLORS, text: string): void {
  process.stdout.write(COLORS[color] + text + COLORS.reset + '\n')
}

function toInt(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

function parseArgs(argv: string[]): Partial<CliOptions> {
  const get = (name: string) => {
    const idx = argv.indexOf(name)
    if (idx === -1) return undefined
    return argv[idx + 1]
  }

  const has = (name: string) => argv.includes(name)

  const result: Partial<CliOptions> = {}

  if (has('--count') || has('-n')) {
    result.count = toInt(get('--count') ?? get('-n'), 1)
  }
  if (has('--concurrency') || has('-c')) {
    result.concurrency = toInt(get('--concurrency') ?? get('-c'), 1)
  }
  if (has('--delayMs') || has('--delay') || has('-d')) {
    result.delayMs = toInt(get('--delayMs') ?? get('--delay') ?? get('-d'), 0)
  }
  if (has('--proxyUrl') || has('--proxy')) {
    result.proxyUrl = get('--proxyUrl') ?? get('--proxy')
  }
  if (has('--email')) {
    result.customEmail = get('--email')
  }
  if (has('--output')) {
    result.outputPath = get('--output')
  }
  if (has('--region')) {
    result.region = get('--region')
  }
  if (has('--emit-builderid-template') || has('--emit-builderid') || has('--builderid-template')) {
    result.emitBuilderIdTemplate = true
  }
  if (has('--templateOutput')) {
    result.templateOutputPath = get('--templateOutput')
  }
  if (has('--incognito')) {
    result.incognitoMode = true
  }
  if (has('--no-incognito')) {
    result.incognitoMode = false
  }
  if (has('--fingerprint')) {
    result.useFingerprint = true
  }
  if (has('--no-fingerprint')) {
    result.useFingerprint = false
  }

  return result
}

async function fileExists(path: string) {
  try {
    await readFile(path, 'utf-8')
    return true
  } catch {
    return false
  }
}

async function runWithConcurrency<TItem>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem, idx: number) => Promise<void>
) {
  let nextIdx = 0

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = nextIdx++
      if (idx >= items.length) return
      await worker(items[idx], idx)
    }
  })

  await Promise.all(runners)
}

const DEFAULT_OPTIONS: CliOptions = {
  count: 1,
  concurrency: 1,
  delayMs: 0,
  proxyUrl: undefined,
  incognitoMode: true,
  useFingerprint: true,
  outputPath: 'show/results.json',
  region: 'us-east-1',
  emitBuilderIdTemplate: true,
  templateOutputPath: 'show/builderid-template.json'
}

async function runRegistration(opts: CliOptions): Promise<{ ok: number; fail: number }> {
  const outPathAbs = resolve(opts.outputPath)
  const outDirAbs = resolve(opts.outputPath, '..')
  await mkdir(outDirAbs, { recursive: true })

  const startedAt = Date.now()
  const total = Math.max(1, opts.count)

  const logInfo = (msg: string) => {
    process.stdout.write(`${msg}\n`)
  }

  const funnyMessages = [
    "Let's go!",
    "Just do it!",
    "Don't be afraid!",
    "Go go go!",
    "Don't hesitate!",
    "Let's go!",
    "Get it done!",
    "Charge!",
    "Go for it!",
    "Let's go!Go go go!"
  ]

  const getRandomFunny = () => funnyMessages[Math.floor(Math.random() * funnyMessages.length)]

  logInfo(`🔥 Let's go!Preparing to create ${opts.count} accounts！concurrent ${opts.concurrency} 个！`)
  logInfo(`   (AWS: Are you serious???)\n`)

  const templateOutAbs = resolve(opts.templateOutputPath)
  
  const allRecords: Array<{
    email?: string
    password?: string
    name?: string
    refreshToken?: string
    clientId?: string
    clientSecret?: string
    success: boolean
    error?: string
  }> = new Array(total).fill(null)

  let completed = 0

  const tasks = Array.from({ length: total }, (_, i) => i)

  await runWithConcurrency(tasks, opts.concurrency, async (idx) => {
    if (opts.delayMs > 0 && idx > 0) {
      await new Promise((r) => setTimeout(r, opts.delayMs))
    }

    const taskNum = idx + 1
    const log = (message: string) => {
      const funny = getRandomFunny()
      process.stdout.write(`[${funny}] 第${taskNum}号选手: ${message}\n`)
    }

    try {
      // Set proxy环境变量（让 fetch 请求也Using proxy）
      if (opts.proxyUrl) {
        process.env.HTTP_PROXY = opts.proxyUrl
        process.env.HTTPS_PROXY = opts.proxyUrl
        process.env.http_proxy = opts.proxyUrl
        process.env.https_proxy = opts.proxyUrl
      }
      
      log('Requesting device code from AWS...')
      const start = await startBuilderIdDeviceLogin(opts.region)
      if (!start.success) {
        throw new Error(start.error)
      }

      log(`Got userCode: ${start.userCode}，Browser launched! Automation started!`)

      const result = await registerAwsBuilderIdTempMail({
        log,
        proxyUrl: opts.proxyUrl,
        customEmail: opts.customEmail,
        incognitoMode: opts.incognitoMode,
        userCode: start.userCode,
        verificationUri: start.verificationUri,
        useFingerprint: opts.useFingerprint
      })

      let refreshToken: string | undefined
      let clientId: string | undefined
      let clientSecret: string | undefined

      if (opts.emitBuilderIdTemplate && result.success) {
        const endAt = start.expiresAt
        let intervalMs = Math.max(1000, start.interval * 1000)

        log('Waiting for AWS confirmation...（It might be confused）')
        while (Date.now() < endAt) {
          const poll = await pollBuilderIdDeviceAuth({
            region: opts.region,
            clientId: start.clientId,
            clientSecret: start.clientSecret,
            deviceCode: start.deviceCode
          })

          if (!poll.success) {
            throw new Error(poll.error)
          }

          if (poll.completed) {
            refreshToken = poll.refreshToken
            clientId = poll.clientId
            clientSecret = poll.clientSecret
            break
          }

          if (poll.status === 'slow_down') {
            intervalMs += 5000
            log('AWS says: Slow down! You are too fast!')
          }

          await new Promise((r) => setTimeout(r, intervalMs))
        }
      }

      allRecords[idx] = {
        email: result.email,
        password: result.password,
        name: result.name,
        refreshToken,
        clientId,
        clientSecret,
        success: result.success,
        error: result.error
      }

      completed++
      if (result.success) {
        log(`✅ Success! Email: ${result.email}！AWS lost another one！`)
      } else {
        log(`❌ Failed: ${result.error}...AWS blocked this one`)
      }
    } catch (e) {
      completed++
      allRecords[idx] = {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
      log(`💥 Crashed: ${allRecords[idx]!.error}！But dont panic！`)
    }
  })

  const ok = allRecords.filter(r => r?.success).length
  const fail = allRecords.filter(r => r && !r.success).length
  const elapsedMs = Date.now() - startedAt
  const elapsedSec = Math.round(elapsedMs / 1000)

  const successRecords = allRecords.filter(r => r?.success && r?.refreshToken)

  print('')
  if (ok > 0 && fail === 0) {
    log('green', `🎉 Let's go!${ok} accountsAll succeeded！Time elapsed ${elapsedSec} seconds！`)
    log('cyan', `   AWS: "This is too hard..."`)
  } else if (ok > 0) {
    log('yellow', `😅 Not bad! Got ${ok} 个，failed ${fail} 个，Time elapsed ${elapsedSec} seconds`)
    log('dim', `   (failed的那些...Try again next time！)`)
  } else {
    log('red', `💀 Total failure! None succeeded！Time elapsed ${elapsedSec} seconds`)
    log('dim', `   (Is it the network? Or did AWS cheat?)`)
  }

  await writeFile(outPathAbs, JSON.stringify(allRecords.filter(Boolean), null, 2), { encoding: 'utf-8' })
  log('green', `\n📁 Results saved to: ${outPathAbs}`)

  if (opts.emitBuilderIdTemplate && successRecords.length > 0) {
    const templateDirAbs = resolve(opts.templateOutputPath, '..')
    await mkdir(templateDirAbs, { recursive: true })
    const templateData = successRecords.map(r => ({
      email: r.email,
      password: r.password,
      refreshToken: r.refreshToken,
      clientId: r.clientId,
      clientSecret: r.clientSecret
    }))
    await writeFile(templateOutAbs, JSON.stringify(templateData, null, 2), { encoding: 'utf-8' })
    log('green', `📁 Template saved to: ${templateOutAbs}`)
    log('dim', `   (Use it with the switcher tool, dont waste it！)`)
  }

  return { ok, fail }
}

async function interactiveMode(initialOptions: Partial<CliOptions>): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve)
    })
  }

  const questionWithDefault = async (prompt: string, defaultValue: string): Promise<string> => {
    const answer = await question(`${prompt} [默认: ${defaultValue}]: `)
    return answer.trim() || defaultValue
  }

  let currentOptions: CliOptions = { ...DEFAULT_OPTIONS, ...initialOptions }
  let running = true

  const showBanner = () => {
    print('')
    log('bright', '╔══════════════════════════════════════════════╗')
    log('bright', '║  🤖 AWS Account Batch Generator v1.0                  ║')
    log('bright', '║     (Free AWS for everyone)                     ║')
    log('bright', '╚══════════════════════════════════════════════╝')
  }

  const showMenu = async () => {
    showBanner()

    print('')
    log('dim', '┌─ ⚙️ Current Configuration ───────────────────────────────')
    log('dim', `│ How many to create: ${currentOptions.count} 个`)
    log('dim', `│ Concurrent: ${currentOptions.concurrency} 个`)
    log('dim', `│ Delay between each: ${currentOptions.delayMs}ms`)
    log('dim', `│ Incognito mode: ${currentOptions.incognitoMode ? '✅ Enabled' : '❌ Disabled'}`)
    log('dim', `│ Fingerprint spoofing: ${currentOptions.useFingerprint ? '✅ Spoofing' : '❌ Original'}`)
    log('dim', `│ Generate template: ${currentOptions.emitBuilderIdTemplate ? '✅ Will generate' : '❌ Wont generate'}`)
    if (currentOptions.proxyUrl) {
      log('dim', `│ Using proxy: ${currentOptions.proxyUrl}`)
    } else {
      log('dim', `│ Using proxy: None (direct connection, AWS knows who you are)`)
    }
    log('dim', '└─────────────────────────────────────────────')
    print('')
    log('cyan', '┌─ 🎮 Operation Menu ───────────────────────────────')
    print(COLORS.cyan + '│' + COLORS.reset + '  [1] 🚀 Start Registration！')
    print(COLORS.cyan + '│' + COLORS.reset + '  [2] 改一下How many to create')
    print(COLORS.cyan + '│' + COLORS.reset + '  [3] 改一下concurrent数 (Dont be too greedy)')
    print(COLORS.cyan + '│' + COLORS.reset + '  [4] Change interval time')
    print(COLORS.cyan + '│' + COLORS.reset + '  [5] 切换Incognito mode')
    print(COLORS.cyan + '│' + COLORS.reset + '  [6] 切换Fingerprint spoofing')
    print(COLORS.cyan + '│' + COLORS.reset + '  [7] 切换是否Generate template')
    print(COLORS.cyan + '│' + COLORS.reset + '  [8] Set proxy (Set one if you dont want to be tracked)')
    print(COLORS.cyan + '│' + COLORS.reset + '  [9] View history')
    print(COLORS.cyan + '│' + COLORS.reset + '  [0] Exit (Quit)')
    log('cyan', '└─────────────────────────────────────────────')
    print('')
  }

  const showHistory = async () => {
    const resultPath = resolve(currentOptions.outputPath)
    const templatePath = resolve(currentOptions.templateOutputPath)

    print('')
    log('cyan', '═══ 📊 History ═══')

    if (await fileExists(templatePath)) {
      try {
        const raw = await readFile(templatePath, 'utf-8')
        const items = JSON.parse(raw)
        log('green', `✅ Template file: ${templatePath}`)
        log('dim', `   Already have ${Array.isArray(items) ? items.length : 0} accounts躺在这里`)
      } catch {
        log('yellow', `⚠️ Template file读不了: ${templatePath}`)
      }
    } else {
      log('yellow', `⚠️ Template file不存在: ${templatePath}`)
      log('dim', `   (Havent registered any accounts yet?)`)
    }

    if (await fileExists(resultPath)) {
      try {
        const raw = await readFile(resultPath, 'utf-8')
        const records = JSON.parse(raw)
        const success = records.filter((r: any) => r.success).length
        const failed = records.filter((r: any) => !r.success).length
        log('dim', `📝 Results file: ${resultPath}`)
        log('dim', `   Total ${records.length} records (success: ${success}, failed: ${failed})`)
        if (failed > success) {
          log('yellow', `   (failed率有点高啊，是不是 AWS 发现你了？)`)
        }
      } catch {
        log('yellow', `⚠️ Results file读不了: ${resultPath}`)
      }
    } else {
      log('yellow', `⚠️ Results file不存在: ${resultPath}`)
    }
  }

  await showMenu()

  while (running) {
    const input = await question(COLORS.green + 'Select a number [0-9] > ' + COLORS.reset)
    const cmd = input.trim()

    switch (cmd) {
      case '1': {
        print('')
        log('cyan', '🔥 Start Registration！AWS 准备好接招了吗？')
        log('dim', '───────────────────────────────────────')
        const result = await runRegistration(currentOptions)
        log('dim', '───────────────────────────────────────')
        if (result.ok > 0) {
          log('magenta', `\n🎉 Done! Successfully created ${result.ok} accounts！`)
        }
        break
      }

      case '2': {
        const answer = await questionWithDefault('要造几accounts', String(currentOptions.count))
        const val = toInt(answer, currentOptions.count)
        if (val < 1) {
          log('red', 'At least create 1, what did you enter?')
        } else if (val > 50) {
          currentOptions.count = val
          log('yellow', `⚠️ Set to ${val} 个...Thats a lot, be careful of getting banned`)
        } else {
          currentOptions.count = val
          log('green', `✓ 好的，Preparing to create ${val} accounts`)
        }
        break
      }

      case '3': {
        const answer = await questionWithDefault('concurrent数', String(currentOptions.concurrency))
        const val = toInt(answer, currentOptions.concurrency)
        if (val < 1) {
          log('red', 'concurrent数至少 1 个，别闹')
        } else if (val > 5) {
          currentOptions.concurrency = val
          log('yellow', `⚠️ concurrent ${val} 个...Can your computer handle it?`)
        } else {
          currentOptions.concurrency = val
          log('green', `✓ concurrent数设为 ${val}`)
        }
        break
      }

      case '4': {
        const answer = await questionWithDefault('任务间隔(ms)', String(currentOptions.delayMs))
        const val = toInt(answer, currentOptions.delayMs)
        if (val < 0) {
          log('red', 'Time cannot go backwards, enter a positive number')
        } else {
          currentOptions.delayMs = val
          if (val === 0) {
            log('green', `✓ No interval, full speed! (AWS: Help!)`)
          } else {
            log('green', `✓ Interval set to ${val}ms，Better to be stable`)
          }
        }
        break
      }

      case '5': {
        currentOptions.incognitoMode = !currentOptions.incognitoMode
        if (currentOptions.incognitoMode) {
          log('green', '✓ Incognito mode已开启 (Browser leaves no traces)')
        } else {
          log('yellow', '⚠️ Incognito mode已关闭 (Are you sure? It will leave traces)')
        }
        break
      }

      case '6': {
        currentOptions.useFingerprint = !currentOptions.useFingerprint
        if (currentOptions.useFingerprint) {
          log('green', '✓ Fingerprint spoofing已开启 (Each browser looks different)')
        } else {
          log('yellow', '⚠️ Fingerprint spoofing已关闭 (AWS might recognize you)')
        }
        break
      }

      case '7': {
        currentOptions.emitBuilderIdTemplate = !currentOptions.emitBuilderIdTemplate
        if (currentOptions.emitBuilderIdTemplate) {
          log('green', '✓ 会Generate template文件 (Convenient for switcher tool)')
        } else {
          log('yellow', '⚠️ 不Generate template (Registration would be wasted)')
        }
        break
      }

      case '8': {
        const current = currentOptions.proxyUrl || '无'
        const answer = await question(`Proxy address (Leave empty to clear) [Current: ${current}]: `)
        if (answer.trim() === '') {
          currentOptions.proxyUrl = undefined
          log('green', '✓ Proxy cleared (Direct connection to AWS)')
        } else {
          currentOptions.proxyUrl = answer.trim()
          log('green', `✓ Proxy set to: ${answer.trim()}`)
          log('dim', '  (Hope your proxy is reliable)')
        }
        break
      }

      case '9': {
        await showHistory()
        break
      }

      case '0':
      case 'q':
      case 'exit':
      case 'quit':
        running = false
        print('')
        log('green', '👋 Bye! Remember to use the switcher tool~')
        break

      default:
        log('yellow', `Input "${input}" 是啥意思？请Input 0-9`)
        break
    }

    if (running && cmd !== '9') {
      print('')
      await showMenu()
    }
  }

  rl.close()
}

async function main() {
  const cliArgs = parseArgs(process.argv.slice(2))
  const hasCliArgs = Object.keys(cliArgs).length > 0
  const nonInteractive = process.argv.includes('--non-interactive') || process.argv.includes('-y')

  if (hasCliArgs && nonInteractive) {
    const opts: CliOptions = { ...DEFAULT_OPTIONS, ...cliArgs }
    const result = await runRegistration(opts)
    process.exitCode = result.fail > 0 ? 1 : 0
  } else {
    await interactiveMode(cliArgs)
  }
}

main().catch((e) => {
  process.stderr.write(`💥 Something went wrong: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
  process.exitCode = 1
})

/**
 * Simplified AWS Builder ID Registration - Workflow Format Only
 * 
 * This is a clean implementation that only supports the new workflow format.
 * Old device code flow and login flow logic have been removed for simplicity.
 */

import type { Page, Browser } from 'playwright'
import { chromium } from 'playwright'
import type { LogCallback } from './register'
import { 
  createTempMail, 
  getTempMailCode, 
  generateRandomName
} from './register'

// Simple helper functions
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(resolve => setTimeout(resolve, delay))
}

async function typeText(page: Page, selector: string, text: string): Promise<void> {
  const input = page.locator(selector).first()
  await input.click()
  await randomDelay(100, 300)
  await input.fill(text)
  await randomDelay(100, 300)
}

async function clickButton(page: Page, selector: string): Promise<boolean> {
  try {
    const button = page.locator(selector).first()
    await button.click()
    return true
  } catch {
    return false
  }
}

/**
 * Simplified workflow registration
 * Flow: Email + Name → Continue → Verification Code → Password → Done
 */
export async function registerWorkflow(options: {
  email?: string
  log: LogCallback
  proxyUrl?: string
  userCode?: string
  verificationUri?: string
  useFingerprint?: boolean
  incognitoMode?: boolean
}): Promise<{ 
  success: boolean
  email?: string
  password?: string
  error?: string 
}> {
  
  const { log, proxyUrl, userCode, verificationUri, useFingerprint = true, incognitoMode = true } = options
  
  let browser: Browser | null = null
  let email = options.email
  let tempMailToken = ''
  
  try {
    // Step 0: Get temp email if not provided
    if (!email) {
      log('Creating temporary email...')
      const tempResult = await createTempMail(log)
      if (!tempResult) {
        return { success: false, error: 'Failed to create temporary email' }
      }
      email = tempResult.email
      tempMailToken = tempResult.token
      log(`✓ Temporary email: ${email}`)
    }
    
    const password = 'TempPass123!'
    const name = generateRandomName()
    
    log('========== Starting AWS Builder ID Registration (Workflow Format) ==========')
    log(`Email: ${email}`)
    log(`Name: ${name}`)
    log(`Password: ${password}`)
    
    // Step 1: Launch browser
    log('\nStep 1: Launching browser...')
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    }
    
    if (proxyUrl) {
      launchOptions.proxy = { server: proxyUrl }
    }
    
    browser = await chromium.launch(launchOptions)
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    const page = await context.newPage()
    
    // Skip fingerprint for now (simplified)
    log('✓ Browser ready')
    
    // Step 2: Navigate to registration page
    const registerUrl = verificationUri || `https://view.awsapps.com/start/#/device?user_code=${userCode}`
    log(`\nStep 2: Navigating to ${registerUrl}`)
    await page.goto(registerUrl, { waitUntil: 'networkidle', timeout: 60000 })
    
    // Wait for potential redirect
    await page.waitForTimeout(1500)
    const currentUrl = page.url()
    log(`Current URL: ${currentUrl}`)
    log(`✓ Page loaded`)
    
    // Step 3: Fill email
    log('\nStep 3: Filling email...')
    
    // Wait for page to be fully loaded
    await page.waitForTimeout(1000)
    
    const emailSelectors = [
      'input[placeholder="username@example.com"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[name="loginfmt"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email"]',
      'input[id*="email"]'
    ]
    
    let emailFilled = false
    for (const selector of emailSelectors) {
      try {
        const input = page.locator(selector).first()
        if (await input.isVisible({ timeout: 5000 })) {
          await typeText(page, selector, email)
          emailFilled = true
          log(`✓ Email filled: ${email}`)
          break
        }
      } catch {}
    }
    
    if (!emailFilled) {
      throw new Error('Email input field not found')
    }
    
    // Step 4: Fill name (workflow format)
    log('\nStep 4: Filling name...')
    await randomDelay(500, 1000)
    
    const nameSelectors = [
      'input[name="name"]',
      'input[autocomplete="name"]',
      'input[placeholder*="name"]',
      'input[type="text"]'
    ]
    
    let nameFilled = false
    for (const selector of nameSelectors) {
      try {
        const input = page.locator(selector).first()
        if (await input.isVisible({ timeout: 2000 })) {
          await typeText(page, selector, name)
          nameFilled = true
          log(`✓ Name filled: ${name}`)
          break
        }
      } catch {}
    }
    
    if (!nameFilled) {
      throw new Error('Name input field not found')
    }
    
    // Step 5: Click Continue
    log('\nStep 5: Clicking Continue...')
    await randomDelay(500, 1000)
    
    const continueSelectors = [
      'button[data-testid="signup-next-button"]',
      'button:has-text("Continue")',
      'button[type="submit"]'
    ]
    
    let continueClicked = false
    for (const selector of continueSelectors) {
      try {
        if (await clickButton(page, selector)) {
          continueClicked = true
          log(`✓ Continue button clicked`)
          break
        }
      } catch {}
    }
    
    if (!continueClicked) {
      throw new Error('Continue button not found')
    }
    
    // Step 6: Wait for verification code page
    log('\nStep 6: Waiting for verification code page...')
    await page.waitForTimeout(1500)
    
    const codeSelectors = [
      'input[placeholder="6-digit"]',
      'input[type="text"][maxlength="6"]',
      'input[class*="awsui_input"][type="text"]'
    ]
    
    let codeInput: string | null = null
    for (const selector of codeSelectors) {
      try {
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: 30000 })
        codeInput = selector
        log(`✓ Verification code input found`)
        break
      } catch {}
    }
    
    if (!codeInput) {
      throw new Error('Verification code input not found')
    }
    
    // Step 7: Get verification code from email
    log('\nStep 7: Getting verification code from email...')
    const code = await getTempMailCode(tempMailToken, email, log, 120)
    
    if (!code) {
      throw new Error('Failed to get verification code from email')
    }
    
    log(`✓ Verification code received: ${code}`)
    
    // Step 8: Fill verification code
    log('\nStep 8: Filling verification code...')
    await simulateHumanType(page, codeInput, code, log)
    log(`✓ Verification code filled`)
    
    // Click verify button
    await randomDelay(500, 1000)
    const verifySelectors = [
      'button[data-testid="email-verification-verify-button"]',
      'button:has-text("Continue")',
      'button[type="submit"]'
    ]
    
    for (const selector of verifySelectors) {
      try {
        if (await clickButton(page, selector)) {
          log(`✓ Verify button clicked`)
          break
        }
      } catch {}
    }
    
    // Step 9: Wait for password page
    log('\nStep 9: Waiting for password page...')
    await page.waitForTimeout(1500)
    
    const passwordSelectors = [
      'input[placeholder*="password"]',
      'input[type="password"]'
    ]
    
    let passwordInput: string | null = null
    for (const selector of passwordSelectors) {
      try {
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: 30000 })
        passwordInput = selector
        log(`✓ Password input found`)
        break
      } catch {}
    }
    
    if (!passwordInput) {
      throw new Error('Password input not found')
    }
    
    // Step 10: Fill password
    log('\nStep 10: Setting password...')
    await simulateHumanType(page, passwordInput, password, log)
    log(`✓ Password filled`)
    
    // Fill confirm password
    await randomDelay(500, 1000)
    const confirmSelectors = [
      'input[placeholder*="confirm"]',
      'input[placeholder*="re-enter"]',
      'input[type="password"]:not(:first-of-type)'
    ]
    
    for (const selector of confirmSelectors) {
      try {
        const input = page.locator(selector).first()
        if (await input.isVisible({ timeout: 2000 })) {
          await typeText(page, selector, password)
          log(`✓ Confirm password filled`)
          break
        }
      } catch {}
    }
    
    // Click final continue
    await randomDelay(500, 1000)
    const finalContinueSelectors = [
      'button:has-text("Continue")',
      'button[type="submit"]'
    ]
    
    for (const selector of finalContinueSelectors) {
      try {
        if (await clickButton(page, selector)) {
          log(`✓ Final continue clicked`)
          break
        }
      } catch {}
    }
    
    // Step 11: Wait for completion
    log('\nStep 11: Waiting for registration completion...')
    await page.waitForTimeout(2000)
    
    log('\n========== Registration Completed Successfully ==========')
    
    await browser.close()
    
    return {
      success: true,
      email,
      password
    }
    
  } catch (error) {
    log(`\n❌ Registration failed: ${error instanceof Error ? error.message : String(error)}`)
    
    if (browser) {
      try {
        await browser.close()
      } catch {}
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

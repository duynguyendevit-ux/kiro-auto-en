import { chromium, Browser, Page } from 'playwright'

type LogCallback = (message: string) => void

const CODE_PATTERNS = [
  /(?:verification\s*code|verification code|Your code is|code is)[：:\s]*(\d{6})/gi,
  /(?:is|为)[：:\s]*(\d{6})\b/gi,
  /^\s*(\d{6})\s*$/gm,
  />\s*(\d{6})\s*</g,
]

const AWS_SENDERS = [
  'no-reply@signin.aws',
  'no-reply@login.awsapps.com',
  'noreply@amazon.com',
  'account-update@amazon.com',
  'no-reply@aws.amazon.com',
  'noreply@aws.amazon.com',
  'aws'
]

const FIRST_NAMES = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Maria', 'Elizabeth', 'Jennifer', 'Linda', 'Barbara', 'Susan', 'Jessica']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Thomas', 'Taylor']

function generateRandomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  return `${first} ${last}`
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(r => setTimeout(r, delay))
}

async function simulateMouseMove(page: Page, targetX: number, targetY: number): Promise<void> {
  try {
    const steps = Math.floor(Math.random() * 10) + 5
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const controlX = targetX / 2 + (Math.random() - 0.5) * 50
      const controlY = targetY / 2 + (Math.random() - 0.5) * 50
      const pointX = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * controlX + t * t * targetX
      const pointY = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * controlY + t * t * targetY
      await page.mouse.move(Math.floor(pointX), Math.floor(pointY))
      if (Math.random() < 0.3) {
        await randomDelay(50, 150)
      }
    }
  } catch {}
}

async function simulateHumanClick(page: Page, selector: string, log: LogCallback): Promise<boolean> {
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout: 5000 })
    
    const box = await element.boundingBox()
    if (!box) {
      await element.click()
      return true
    }
    
    const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * 10
    const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * 5
    
    await simulateMouseMove(page, targetX, targetY)
    await randomDelay(500, 1500)
    await element.click()
    return true
  } catch {
    return false
  }
}

async function simulateHumanType(page: Page, selector: string, text: string, log: LogCallback): Promise<boolean> {
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout: 5000 })
    
    const box = await element.boundingBox()
    if (box) {
      const targetX = box.x + box.width / 2
      const targetY = box.y + box.height / 2
      await simulateMouseMove(page, targetX, targetY)
    }
    
    await randomDelay(300, 800)
    await element.click()
    await randomDelay(300, 800)
    await element.clear()
    
    for (const char of text) {
      await element.pressSequentially(char, { delay: Math.floor(Math.random() * 100) + 50 })
    }
    return true
  } catch {
    return false
  }
}

async function simulatePageScroll(page: Page): Promise<void> {
  try {
    const scrollAmount = Math.floor(Math.random() * 200) + 100
    const direction = Math.random() > 0.5 ? 1 : -1
    await page.evaluate((amount) => {
      window.scrollBy(0, amount)
    }, scrollAmount * direction)
    await randomDelay(800, 2000)
  } catch {}
}

async function simulatePreRegistrationBehavior(page: Page, log: LogCallback): Promise<void> {
  log('[Anti-detection] Simulating user warm-up behavior...')
  
  await randomDelay(500, 1500)
  
  for (let i = 0; i < 3; i++) {
    await simulatePageScroll(page)
    await randomDelay(300, 800)
  }
  
  const viewport = page.viewportSize()
  if (viewport) {
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(Math.random() * viewport.width)
      const y = Math.floor(Math.random() * viewport.height)
      await simulateMouseMove(page, x, y)
      await randomDelay(800, 2000)
    }
  }
  
  log('[Anti-detection] ✓ Warm-up behavior completed')
}

function htmlToText(html: string): string {
  if (!html) return ''
  
  let text = html
  
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
  
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')
  
  text = text.replace(/<[^>]+>/g, ' ')
  
  text = text.replace(/\s+/g, ' ')
  
  return text.trim()
}

function extractCode(text: string): string | null {
  if (!text) return null
  
  for (const pattern of CODE_PATTERNS) {
    pattern.lastIndex = 0
    
    let match
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1]
      if (code && /^\d{6}$/.test(code)) {
        const start = Math.max(0, match.index - 20)
        const end = Math.min(text.length, match.index + match[0].length + 20)
        const context = text.slice(start, end)
        
        if (context.includes('#' + code)) continue
        if (/color[:\s]*[^;]*\d{6}/i.test(context)) continue
        if (/rgb|rgba|hsl/i.test(context)) continue
        if (/\d{7,}/.test(context)) continue
        
        return code
      }
    }
  }
  return null
}

export async function getOutlookVerificationCode(
  refreshToken: string,
  clientId: string,
  log: LogCallback,
  timeout: number = 120
): Promise<string | null> {
  log('========== Starting to get email verification code ==========')
  log(`client_id: ${clientId}`)
  log(`refresh_token: ${refreshToken.substring(0, 30)}...`)
  
  const startTime = Date.now()
  const checkInterval = 5000
  const checkedIds = new Set<string>()
  
  while (Date.now() - startTime < timeout * 1000) {
    try {
      log('Refreshing access_token...')
      let accessToken: string | null = null
      
      const tokenAttempts = [
        { url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token', scope: null },
        { url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scope: null },
      ]
      
      for (const attempt of tokenAttempts) {
        try {
          const tokenBody = new URLSearchParams()
          tokenBody.append('client_id', clientId)
          tokenBody.append('refresh_token', refreshToken)
          tokenBody.append('grant_type', 'refresh_token')
          if (attempt.scope) {
            tokenBody.append('scope', attempt.scope)
          }
          
          const tokenResponse = await fetch(attempt.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody.toString()
          })
          
          if (tokenResponse.ok) {
            const tokenResult = await tokenResponse.json() as { access_token: string }
            accessToken = tokenResult.access_token
            log('✓ Successfully obtained access_token')
            break
          }
        } catch {
          continue
        }
      }
      
      if (!accessToken) {
        log('✗ Token refresh failed')
        return null
      }
      
      log('Getting email list...')
      const graphParams = new URLSearchParams({
        '$top': '50',
        '$orderby': 'receivedDateTime desc',
        '$select': 'id,subject,from,receivedDateTime,bodyPreview,body'
      })
      
      const mailResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${graphParams}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!mailResponse.ok) {
        log(`Failed to get emails: ${mailResponse.status}`)
        await new Promise(r => setTimeout(r, checkInterval))
        continue
      }
      
      const mailData = await mailResponse.json() as {
        value: Array<{
          id: string
          subject: string
          from: { emailAddress: { address: string } }
          body: { content: string }
          bodyPreview: string
          receivedDateTime: string
        }>
      }
      
      log(`Got ${mailData.value?.length || 0} emails`)
      
      for (const mail of mailData.value || []) {
        const fromEmail = mail.from?.emailAddress?.address?.toLowerCase() || ''
        const isAwsSender = AWS_SENDERS.some(s => fromEmail.includes(s.toLowerCase()))
        
        if (isAwsSender && !checkedIds.has(mail.id)) {
          checkedIds.add(mail.id)
          
          log(`\n=== Checking AWS email ===`)
          log(`  Sender: ${fromEmail}`)
          log(`  Subject: ${mail.subject?.substring(0, 50)}`)
          
          let code: string | null = null
          const bodyText = htmlToText(mail.body?.content || '')
          if (bodyText) {
            code = extractCode(bodyText)
          }
          if (!code) {
            code = extractCode(mail.body?.content || '')
          }
          if (!code) {
            code = extractCode(mail.bodyPreview || '')
          }
          
          if (code) {
            log(`\n========== Found verification code: ${code} ==========`)
            return code
          }
        }
      }
      
      log(`未Found verification code，${checkInterval / 1000}seconds before retry...`)
      await new Promise(r => setTimeout(r, checkInterval))
      
    } catch (error) {
      log(`Error getting verification code: ${error}`)
      await new Promise(r => setTimeout(r, checkInterval))
    }
  }
  
  log('Verification code timeout')
  return null
}

export async function createTempMail(
  log: LogCallback,
  timeout: number = 30
): Promise<{ email: string; token: string; password?: string } | null> {
  const yydsMailApiKey = process.env.YYDS_MAIL_API_KEY || process.env.MALIAPI_215_API_KEY
  const services = [
    {
      name: '215.im (YYDS Mail)',
      createUrl: 'https://maliapi.215.im/v1/accounts',
      inboxUrl: (_token: string, email: string) => `https://maliapi.215.im/v1/messages?address=${email}`,
      maxAttempts: 10,
      preferredDomain: '0m0.abrdns.com'
    },
    {
      name: 'tempmail.lol',
      createUrl: 'https://api.tempmail.lol/v2/inbox/create',
      inboxUrl: (token: string) => `https://api.tempmail.lol/v2/inbox?token=${token}`,
      maxAttempts: 10
    },
    {
      name: 'mail.tm',
      createUrl: 'https://api.mail.tm/accounts',
      inboxUrl: (_token: string) => `https://api.mail.tm/messages`,
      requiresAuth: true,
      maxAttempts: 5
    },
    {
      name: '1secmail.com',
      createUrl: 'https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1',
      inboxUrl: (email: string) => `https://www.1secmail.com/api/v1/?action=getMessages&login=${email.split('@')[0]}&domain=${email.split('@')[1]}`,
      maxAttempts: 5
    },
    {
      name: 'tempmail.plus',
      createUrl: 'https://tempmail.plus/api/mails',
      inboxUrl: (email: string) => `https://tempmail.plus/api/mails/${email}`,
      maxAttempts: 5
    },
    {
      name: 'guerrillamail.com',
      createUrl: 'https://api.guerrillamail.com/ajax.php?f=get_email_address',
      inboxUrl: (token: string) => `https://api.guerrillamail.com/ajax.php?f=get_email_list&sid_token=${token}`,
      maxAttempts: 3
    }
  ]
  
  for (const service of services) {
    log(`========== Trying from ${service.name} to get temporary email (trying multiple domains)==========`)
    const startTime = Date.now()
    let attemptCount = 0
    const usedDomains = new Set<string>()
    
    while (Date.now() - startTime < timeout * 1000 && attemptCount < service.maxAttempts) {
      try {
        attemptCount++
        
        if (service.name === '215.im (YYDS Mail)') {
          if (!yydsMailApiKey) {
            log('  ⚠ Not set YYDS_MAIL_API_KEY（或 MALIAPI_215_API_KEY），Skipping 215.im service')
            break
          }
          
          const randomPrefix = Math.random().toString(36).substring(2, 10)
          const requestBody = {
            address: randomPrefix,
            domain: '0m0.abrdns.com'
          }
          
          log(`  Trying to create email: ${randomPrefix}@0m0.abrdns.com (using API Key)`)
          
          const resp = await fetch(service.createUrl, {
            method: 'POST',
            headers: {
              'X-API-Key': yydsMailApiKey,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          })
          
          if (resp.ok) {
            const result = await resp.json() as { success: boolean; data?: { address: string; token: string } }
            if (result.success && result.data && result.data.address && result.data.token) {
              const domain = result.data.address.split('@')[1]
              usedDomains.add(domain)
              
              const password = Math.random().toString(36).slice(-8) + 'A1!'
              log(`✓ Successfully obtained temporary email: ${result.data.address} (domain: ${domain})`)
              log(`  Token: ${result.data.token.substring(0, 20)}...`)
              return { email: result.data.address, token: result.data.token, password }
            } else {
              log(`  API returned wrong format: ${JSON.stringify(result)}`)
            }
          } else {
            const errorText = await resp.text()
            log(`  Attempt ${attemptCount} request failed: ${resp.status} - ${errorText}`)
          }
        } else if (service.name === 'tempmail.lol') {
          const resp = await fetch(service.createUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          })
          
          if (resp.ok) {
            const data = await resp.json() as { address: string; token: string }
            if (data.address && data.token) {
              const domain = data.address.split('@')[1]
              usedDomains.add(domain)
              
              const password = Math.random().toString(36).slice(-8) + 'A1!'
              log(`✓ Successfully obtained temporary email: ${data.address} (domain: ${domain}, Attempt ${attemptCount} attempt)`)
              log(`  Tried domains: ${Array.from(usedDomains).join(', ')}`)
              return { email: data.address, token: data.token, password }
            }
          } else {
            log(`  Attempt ${attemptCount} request failed: ${resp.status}`)
          }
        } else if (service.name === '1secmail.com') {
          const resp = await fetch(service.createUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          })
          
          if (resp.ok) {
            const data = await resp.json() as string[]
            if (data && data.length > 0 && data[0]) {
              const email = data[0]
              const domain = email.split('@')[1]
              usedDomains.add(domain)
              
              const password = Math.random().toString(36).slice(-8) + 'A1!'
              log(`✓ Successfully obtained temporary email: ${email} (domain: ${domain}, Attempt ${attemptCount} attempt)`)
              return { email, token: email, password }
            }
          }
        } else if (service.name === 'tempmail.plus') {
          const resp = await fetch(service.createUrl, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          })
          
          if (resp.ok) {
            const data = await resp.json() as { email: string; token?: string }
            if (data && data.email) {
              const domain = data.email.split('@')[1]
              usedDomains.add(domain)
              
              const password = Math.random().toString(36).slice(-8) + 'A1!'
              log(`✓ Successfully obtained temporary email: ${data.email} (domain: ${domain}, Attempt ${attemptCount} attempt)`)
              return { email: data.email, token: data.token || data.email, password }
            }
          }
        } else if (service.name === 'guerrillamail.com') {
          const resp = await fetch(service.createUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          })
          
          if (resp.ok) {
            const data = await resp.json() as { email_addr: string; sid_token: string }
            if (data && data.email_addr && data.sid_token) {
              const domain = data.email_addr.split('@')[1]
              usedDomains.add(domain)
              
              const password = Math.random().toString(36).slice(-8) + 'A1!'
              log(`✓ Successfully obtained temporary email: ${data.email_addr} (domain: ${domain}, Attempt ${attemptCount} attempt)`)
              return { email: data.email_addr, token: data.sid_token, password }
            }
          }
        } else if (service.name === 'mail.tm') {
          const randomUser = 'user' + Math.random().toString(36).slice(-8)
          const password = Math.random().toString(36).slice(-8) + 'A1!'
          
          const domainsResp = await fetch('https://api.mail.tm/domains', {
            headers: {
              'Accept': 'application/json'
            }
          })
          
          if (!domainsResp.ok) {
            log(`mail.tm Failed to get domains，Skipping`)
            break
          }
          
          const domainsData = await domainsResp.json() as { 'hydra:member': Array<{ domain: string }> }
          const domains = domainsData['hydra:member'] || []
          
          if (domains.length === 0) {
            log(`mail.tm 无可用domain，Skipping`)
            break
          }
          
          const email = `${randomUser}@${domains[0].domain}`
          
          const createResp = await fetch(service.createUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ address: email, password })
          })
          
          if (!createResp.ok) {
            log(`mail.tm 创建账号失败: ${createResp.status}`)
            break
          }
          
          const loginResp = await fetch('https://api.mail.tm/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ address: email, password })
          })
          
          if (loginResp.ok) {
            const loginData = await loginResp.json() as { token: string }
            if (loginData.token) {
              log(`✓ Successfully obtained temporary email: ${email}`)
              return { email, token: loginData.token, password }
            }
          }
        }
      } catch (error) {
        log(`${service.name} Attempt ${attemptCount} attempts failed: ${error}`)
      }
      
      if (attemptCount < service.maxAttempts) {
        await new Promise(r => setTimeout(r, 500))
      }
    }
    
    log(`✗ ${service.name} tried ${attemptCount} attempts, obtained domains: ${Array.from(usedDomains).join(', ')}`)
    log(`  Trying next service...`)
  }
  
  log('✗ 所有临时Emailservice均失败')
  return null
}

export async function getTempMailCode(
  token: string,
  email: string,
  log: LogCallback,
  timeout: number = 120
): Promise<string | null> {
  log(`========== Starting to wait for email ${email} to receive AWS verification code ==========`)
  
  const emailDomain = email.split('@')[1]?.toLowerCase() || ''
  const is215Im = emailDomain.includes('abrdns') || emailDomain.includes('yyds.dev')
  const isMailTm = emailDomain.includes('mail.tm') || emailDomain.endsWith('.tm')
  const is1SecMail = emailDomain.includes('1secmail') || emailDomain.includes('esiix') || emailDomain.includes('wwjmp') || emailDomain.includes('icznn')
  const isTempMailPlus = emailDomain.includes('tempmail.plus') || emailDomain.includes('tmpbox')
  const isGuerrillaMail = emailDomain.includes('guerrillamail') || emailDomain.includes('grr.la') || emailDomain.includes('sharklasers')
  
  let serviceName = 'tempmail.lol'
  if (is215Im) serviceName = '215.im'
  else if (isMailTm) serviceName = 'mail.tm'
  else if (is1SecMail) serviceName = '1secmail.com'
  else if (isTempMailPlus) serviceName = 'tempmail.plus'
  else if (isGuerrillaMail) serviceName = 'guerrillamail.com'
  
  log(`[DEBUG] Emaildomain: ${emailDomain}, 使用service: ${serviceName}`)
  
  const startTime = Date.now()
  const checkInterval = 3000
  const seenIds = new Set<string>()
  
  while (Date.now() - startTime < timeout * 1000) {
    try {
      let messages: Array<{ from: string; subject: string; body?: string; html?: string; text?: string }> = []
      
      if (serviceName === '215.im') {
        const url = `https://maliapi.215.im/v1/messages?address=${encodeURIComponent(email)}`
        const resp = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
        
        if (resp.ok) {
          const data = await resp.json() as { success: boolean; data?: { messages: Array<{ id: string; from: { address: string }; subject: string; text?: string; html?: string[] }> } }
          if (data.success && data.data && data.data.messages) {
            for (const msg of data.data.messages) {
              try {
                const detailResp = await fetch(`https://maliapi.215.im/v1/messages/${msg.id}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                  }
                })
                
                if (detailResp.ok) {
                  const detailData = await detailResp.json() as { success: boolean; data?: { text?: string; html?: string[] } }
                  if (detailData.success && detailData.data) {
                    messages.push({
                      from: msg.from.address,
                      subject: msg.subject,
                      body: detailData.data.text || '',
                      html: Array.isArray(detailData.data.html) ? detailData.data.html.join('') : detailData.data.html
                    })
                  }
                } else {
                  messages.push({
                    from: msg.from.address,
                    subject: msg.subject,
                    body: msg.text || '',
                    html: Array.isArray(msg.html) ? msg.html.join('') : msg.html
                  })
                }
              } catch (e) {
                log(`Getting email ${msg.id} details failed: ${e}`)
              }
            }
          }
        }
      } else if (serviceName === 'mail.tm') {
        const resp = await fetch('https://api.mail.tm/messages', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
        
        if (resp.ok) {
          const data = await resp.json() as { 'hydra:member': Array<{ id: string; from: { address: string }; subject: string; intro: string }> }
          messages = (data['hydra:member'] || []).map(msg => ({
            from: msg.from.address,
            subject: msg.subject,
            body: msg.intro,
            html: msg.intro
          }))
        }
      } else if (serviceName === '1secmail.com') {
        const [login, domain] = email.split('@')
        const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        })
        
        if (resp.ok) {
          const data = await resp.json() as Array<{ id: number; from: string; subject: string; date: string }>
          for (const msg of data || []) {
            const detailResp = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`)
            if (detailResp.ok) {
              const detail = await detailResp.json() as { body: string; htmlBody: string; textBody: string }
              messages.push({
                from: msg.from,
                subject: msg.subject,
                body: detail.textBody || detail.body,
                html: detail.htmlBody
              })
            }
          }
        }
      } else if (serviceName === 'tempmail.plus') {
        const url = `https://tempmail.plus/api/mails/${email}`
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        })
        
        if (resp.ok) {
          const data = await resp.json() as { mails: Array<{ from: string; subject: string; body: string; html: string }> }
          messages = (data.mails || []).map(msg => ({
            from: msg.from,
            subject: msg.subject,
            body: msg.body,
            html: msg.html
          }))
        }
      } else if (serviceName === 'guerrillamail.com') {
        const url = `https://api.guerrillamail.com/ajax.php?f=get_email_list&sid_token=${token}`
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        })
        
        if (resp.ok) {
          const data = await resp.json() as { list: Array<{ mail_id: string; mail_from: string; mail_subject: string; mail_excerpt: string }> }
          for (const msg of data.list || []) {
            const detailResp = await fetch(`https://api.guerrillamail.com/ajax.php?f=fetch_email&sid_token=${token}&email_id=${msg.mail_id}`)
            if (detailResp.ok) {
              const detail = await detailResp.json() as { mail_body: string }
              messages.push({
                from: msg.mail_from,
                subject: msg.mail_subject,
                body: detail.mail_body,
                html: detail.mail_body
              })
            }
          }
        }
      } else {
        const url = `https://api.tempmail.lol/v2/inbox?token=${token}`
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        })
        
        if (resp.ok) {
          const data = await resp.json() as { emails: Array<{ from: string; subject: string; body: string; html: string }> }
          messages = data.emails || []
        }
      }
      
      if (!messages || messages.length === 0) {
        await new Promise(r => setTimeout(r, checkInterval))
        continue
      }
      
      for (const msg of messages) {
        const content = `${msg.body || ''}\n${msg.html || ''}\n${msg.text || ''}`
        const msgHash = `${msg.subject?.substring(0,20)}_${content.length}`
        
        if (seenIds.has(msgHash)) continue
        seenIds.add(msgHash)
        
        const sender = (msg.from || '').toLowerCase()
        const subject = (msg.subject || '').toLowerCase()
        
        const isAwsSender = AWS_SENDERS.some(s => sender.includes(s.toLowerCase()))
        if (!isAwsSender && !subject.includes('aws') && !subject.includes('amazon') && !content.includes('aws')) {
          continue
        }
        
        log(`\n=== Received new email ===`)
        log(`  Sender: ${sender}`)
        log(`  Subject: ${subject}`)
        
        const bodyText = htmlToText(msg.html || '') || msg.body || ''
        let code = extractCode(subject) || extractCode(bodyText) || extractCode(content)
        
        if (code) {
          log(`\n========== Found verification code: ${code} ==========`)
          return code
        }
      }
    } catch (error) {
       // 忽略错误，继续轮询
    }
    
    await new Promise(r => setTimeout(r, checkInterval))
  }
  
  log('✗ Verification code timeout')
  return null
}

async function waitAndFill(
  page: Page,
  selector: string,
  value: string,
  log: LogCallback,
  description: string,
  timeout: number = 30000
): Promise<boolean> {
  log(`Waiting for${description}to appear...`)
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout })
    
    const box = await element.boundingBox()
    if (box) {
      const targetX = box.x + box.width / 2
      const targetY = box.y + box.height / 2
      await simulateMouseMove(page, targetX, targetY)
    }
    
    await randomDelay(500, 1500)
    await element.click()
    await randomDelay(300, 800)
    await element.clear()
    
    for (const char of value) {
      await page.keyboard.type(char)
      await randomDelay(50, 150)
    }
    
    log(`✓ Entered${description}: ${value}`)
    return true
  } catch (error) {
    log(`✗ ${description}Operation failed: ${error}`)
    return false
  }
}

async function tryClickSelectors(
  page: Page,
  selectors: string[],
  log: LogCallback,
  description: string,
  timeout: number = 15000
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first()
      await element.waitFor({ state: 'visible', timeout: timeout / selectors.length })
      await page.waitForTimeout(300)
      await element.click()
      log(`✓ Clicked${description}`)
      return true
    } catch {
      continue
    }
  }
  log(`✗ Not found${description}`)
  return false
}

async function checkAndRetryOnError(
  page: Page,
  buttonSelector: string,
  log: LogCallback,
  description: string,
  maxRetries: number = 5,
  retryDelay: number = 3000
): Promise<boolean> {
  const errorSelectors = [
    'div.awsui_content_mx3cw_97dyn_391',
    '[class*="awsui_content_"]',
    '.awsui-flash-error',
    '[data-testid="flash-error"]',
    'div[role="alert"]'
  ]
  
  const errorTexts = [
    '错误',
    '抱歉，处理您的请求时出错',
    'Sorry, there was an error processing your request',
    'error processing your request',
    'Please try again',
    '请重试'
  ]
  
  const closeButtonSelectors = [
    'button[aria-label="关闭"]',
    'button[aria-label="Close"]',
    'button.awsui_dismiss-button',
    '[class*="awsui_dismiss"]'
  ]
  
  for (let retry = 0; retry < maxRetries; retry++) {
    await page.waitForTimeout(2000)
    
    let hasError = false
    
    for (const selector of errorSelectors) {
      try {
        const errorElements = await page.locator(selector).all()
        for (const el of errorElements) {
          const text = await el.textContent()
          if (text && errorTexts.some(errText => text.includes(errText))) {
            hasError = true
            log(`⚠ Detected error popup: "${text.substring(0, 80)}..."`)
            break
          }
        }
        if (hasError) break
      } catch {
        continue
      }
    }
    
    if (!hasError) {
      return true
    }
    
    if (retry < maxRetries - 1) {
      log('Trying to close error popup...')
      let closed = false
      for (const closeSelector of closeButtonSelectors) {
        try {
          const closeBtn = page.locator(closeSelector).first()
          if (await closeBtn.isVisible({ timeout: 2000 })) {
            await closeBtn.click()
            log('✓ Error popup closed')
            closed = true
            break
          }
        } catch {
          continue
        }
      }
      
      if (!closed) {
        log('Close button not found, trying Escape key')
        await page.keyboard.press('Escape')
      }
      
      log(`Waiting for ${retryDelay / 1000} seconds before retry点击${description} (${retry + 2}/${maxRetries})...`)
      await page.waitForTimeout(retryDelay)
      
      try {
        const button = page.locator(buttonSelector).first()
        await button.waitFor({ state: 'visible', timeout: 5000 })
        await button.click()
        log(`✓ Re-clicked${description}`)
      } catch (e) {
        log(`✗ Re-click failed: ${e}`)
      }
    }
  }
  
  log(`✗ ${description}Still failed after multiple retries`)
  return false
}

async function waitAndClickWithRetry(
  page: Page,
  selector: string,
  log: LogCallback,
  description: string,
  timeout: number = 30000,
  maxRetries: number = 3
): Promise<boolean> {
  log(`Waiting for${description}to appear...`)
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout })
    
    const box = await element.boundingBox()
    if (box) {
      const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * 10
      const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * 5
      await simulateMouseMove(page, targetX, targetY)
    }
    
    await randomDelay(500, 1500)
    await element.click()
    log(`✓ Clicked${description}`)
    
    const success = await checkAndRetryOnError(page, selector, log, description, maxRetries)
    return success
  } catch (error) {
    log(`✗ Click failed: ${error}`)
    return false
  }
}

export async function activateOutlook(
  email: string,
  emailPassword: string,
  log: LogCallback,
  incognitoMode: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const activationUrl = 'https://go.microsoft.com/fwlink/p/?linkid=2125442'
  let browser: Browser | null = null
  
  log('========== 开始激活 Outlook Email ==========')
  log(`Incognito mode: ${incognitoMode ? 'Enabled' : '已禁用'}`)
  log(`Email: ${email}`)
  
  try {
    log(`\nStep1: Launch browser${incognitoMode ? '（Incognito mode）' : ''}（headless mode），访问 Outlook 激活页面...`)
    
    const launchOptions: any = {
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    }
    
    if (!incognitoMode) {
      launchOptions.args.push('--disable-session-crashed-bubble')
    }
    
    browser = await chromium.launch(launchOptions)
    
    const contextOptions: any = {
      viewport: { width: 1400, height: 1000 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    if (incognitoMode) {
      contextOptions.acceptDownloads = false
      contextOptions.ignoreHTTPSErrors = false
    }
    
    const context = await browser.newContext(contextOptions)
    
    const page = await context.newPage()
    
    await page.goto(activationUrl, { waitUntil: 'networkidle', timeout: 60000 })
    log(`✓ Page loaded${incognitoMode ? '（Incognito mode）' : ''}`)
    
    await simulatePreRegistrationBehavior(page, log)
    
    log('\nStep2: 输入Email...')
    const emailInputSelectors = [
      'input#i0116[type="email"]',
      'input[name="loginfmt"]',
      'input[type="email"]'
    ]
    
    let emailFilled = false
    for (const selector of emailInputSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 10000 })
        await element.fill(email)
        log(`✓ EnteredEmail: ${email}`)
        emailFilled = true
        break
      } catch {
        continue
      }
    }
    
    if (!emailFilled) {
      throw new Error('Not foundEmail input field')
    }
    
    await page.waitForTimeout(1000)
    
    log('\nStep3: 点击下一步按钮...')
    const firstNextSelectors = [
      'input#idSIButton9[type="submit"]',
      'input[type="submit"][value="下一步"]',
      'input[type="submit"][value="Next"]'
    ]
    
    if (!await tryClickSelectors(page, firstNextSelectors, log, 'Attempt一个下一步按钮')) {
      throw new Error('Click failed')
    }
    
    await page.waitForTimeout(3000)
    
    log('\nStep4: 输入Password...')
    const passwordInputSelectors = [
      'input#passwordEntry[type="password"]',
      'input#i0118[type="password"]',
      'input[name="passwd"][type="password"]',
      'input[type="password"]'
    ]
    
    let passwordFilled = false
    for (const selector of passwordInputSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 15000 })
        await element.fill(emailPassword)
        log('✓ EnteredPassword')
        passwordFilled = true
        break
      } catch {
        continue
      }
    }
    
    if (!passwordFilled) {
      throw new Error('Not foundPassword input field')
    }
    
    await page.waitForTimeout(1000)
    
    log('\nStep5: 点击login按钮...')
    const loginButtonSelectors = [
      'button[type="submit"][data-testid="primaryButton"]',
      'input#idSIButton9[type="submit"]',
      'button:has-text("下一步")',
      'button:has-text("login")',
      'button:has-text("Sign in")',
      'button:has-text("Next")'
    ]
    
    if (!await tryClickSelectors(page, loginButtonSelectors, log, 'login按钮')) {
      throw new Error('Click failed')
    }
    
    await page.waitForTimeout(3000)
    
    log('\nStep6: 点击Attempt一个"暂时Skipping"链接...')
    const skipSelector = 'a#iShowSkip'
    try {
      const skipElement = page.locator(skipSelector).first()
      await skipElement.waitFor({ state: 'visible', timeout: 30000 })
      await skipElement.click()
      log('✓ ClickedAttempt一个"暂时Skipping"')
      await page.waitForTimeout(3000)
    } catch {
      log('Not foundAttempt一个"暂时Skipping"链接，可能已Skipping此Step')
    }
    
    log('\nStep7: 点击Attempt二个"暂时Skipping"链接...')
    try {
      const skipElement = page.locator(skipSelector).first()
      await skipElement.waitFor({ state: 'visible', timeout: 15000 })
      await skipElement.click()
      log('✓ ClickedAttempt二个"暂时Skipping"')
      await page.waitForTimeout(3000)
    } catch {
      log('Not foundAttempt二个"暂时Skipping"链接，可能已Skipping此Step')
    }
    
    log('\nStep8: 点击"取消"按钮（Skipping密钥创建）...')
    const cancelButtonSelectors = [
      'button[data-testid="secondaryButton"]:has-text("取消")',
      'button[data-testid="secondaryButton"]:has-text("Cancel")',
      'button[type="button"]:has-text("取消")',
      'button[type="button"]:has-text("Cancel")'
    ]
    
    if (!await tryClickSelectors(page, cancelButtonSelectors, log, '"取消"按钮', 15000)) {
      log('Not found"取消"按钮，可能已Skipping此Step')
    }
    
    await page.waitForTimeout(3000)
    
    log('\nStep9: 点击"Yes"按钮（保持login状态）...')
    const yesButtonSelectors = [
      'button[type="submit"][data-testid="primaryButton"]:has-text("Yes")',
      'button[type="submit"][data-testid="primaryButton"]:has-text("Yes")',
      'input#idSIButton9[value="Yes"]',
      'input#idSIButton9[value="Yes"]',
      'button:has-text("Yes")',
      'button:has-text("Yes")'
    ]
    
    if (!await tryClickSelectors(page, yesButtonSelectors, log, '"Yes"按钮', 15000)) {
      log('Not found"Yes"按钮，可能已Skipping此Step')
    }
    
    await page.waitForTimeout(5000)
    
    log('\nStep10: Waiting for Outlook Email加载完成...')
    const newMailSelectors = [
      'button[aria-label="New mail"]',
      'button:has-text("New mail")',
      'button:has-text("新邮件")',
      'span:has-text("New mail")',
      '[data-automation-type="RibbonSplitButton"]'
    ]
    
    let outlookLoaded = false
    for (const selector of newMailSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 30000 })
        log('✓ Outlook Email激活成功！')
        outlookLoaded = true
        break
      } catch {
        continue
      }
    }
    
    if (!outlookLoaded) {
      const currentUrl = page.url()
      if (currentUrl.toLowerCase().includes('outlook') || currentUrl.toLowerCase().includes('mail')) {
        log('✓ 已进入 Outlook Email页面，激活成功！')
        outlookLoaded = true
      }
    }
    
    await page.waitForTimeout(2000)
    await browser.close()
    browser = null
    
    if (outlookLoaded) {
      log('\n========== Outlook Email激活完成 ==========')
      return { success: true }
    } else {
      log('\n⚠ Outlook Email激活可能未完成')
      return { success: false, error: 'Outlook Email激活可能未完成' }
    }
    
  } catch (error) {
    log(`\n✗ Outlook 激活失败: ${error}`)
    if (browser) {
      try { await browser.close() } catch {}
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function autoRegisterAWS(
  email: string | undefined,
  refreshToken: string | undefined,
  clientId: string | undefined,
  log: LogCallback,
  emailPassword?: string,
  skipOutlookActivation: boolean = false,
  proxyUrl?: string,
  incognitoMode: boolean = true,
  useTempMail: boolean = false,
  userCode?: string,
  verificationUri?: string,
  useFingerprint: boolean = true,
  fingerprintProfile?: any
): Promise<{ success: boolean; ssoToken?: string; name?: string; error?: string; email?: string; password?: string }> {
  let tempMailToken = ''
  if (useTempMail) {
    const tempResult = await createTempMail(log)
    if (!tempResult) {
      return { success: false, error: 'Failed to get temporary email' }
    }
    email = tempResult.email
    emailPassword = tempResult.password
    tempMailToken = tempResult.token
    log(`✓ Ready to register with temporary email: ${email}`)
  }

  if (!email) {
    return { success: false, error: '未提供Email地址' }
  }

  const password = emailPassword || 'admin123456aA!'
  const randomName = generateRandomName()
  let browser: Browser | null = null
  
  log('========== Starting automatic AWS Builder ID registration ==========')
  log(`Incognito mode: ${incognitoMode ? 'Enabled' : '已禁用'}`)
  if (!skipOutlookActivation && email.toLowerCase().includes('outlook') && emailPassword) {
    log('检测到 Outlook Email，先进行激活（不使用代理）...')
    const activationResult = await activateOutlook(email, emailPassword, log)
    if (!activationResult.success) {
      log(`⚠ Outlook 激活可能未完成: ${activationResult.error}`)
      log('Continuing AWS registration...')
    } else {
      log('Outlook 激活成功，开始 AWS 注册...')
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  
  log('========== Starting AWS Builder ID registration ==========')
  log(`Email: ${email}`)
  log(`Name: ${randomName}`)
  log(`Password: ${password}`)
  if (proxyUrl) {
    log(`代理: ${proxyUrl}`)
  }
  log(`Using fingerprint: ${useFingerprint ? 'Yes' : 'No'}`)
  
  let profile: any = fingerprintProfile
  if (useFingerprint && !profile) {
    log('\n[Fingerprint] Generating new fingerprint configuration...')
    const { FingerprintGenerator } = await import('./fingerprint/generator')
    const generator = new FingerprintGenerator()
    profile = generator.generate()
    log(`[Fingerprint] User Agent: ${profile.navigator.userAgent}`)
    log(`[Fingerprint] Platform: ${profile.navigator.platform}`)
    log(`[Fingerprint] Screen: ${profile.screen.width}x${profile.screen.height}`)
    log(`[Fingerprint] Hardware: ${profile.hardware.hardwareConcurrency} cores, ${profile.hardware.deviceMemory}GB RAM`)
  }
  
  try {
    log(`\nStep1: Launch browser${incognitoMode ? '（Incognito mode）' : ''}${useFingerprint ? '（fingerprint applied）' : ''}（headless mode），navigate to registration page...`)
    
    const launchOptions: any = {
      headless: true,
      proxy: proxyUrl ? { server: proxyUrl } : undefined,
      args: ['--disable-blink-features=AutomationControlled']
    }
    
    if (!incognitoMode) {
      launchOptions.args.push('--disable-session-crashed-bubble')
    }
    
    browser = await chromium.launch(launchOptions)
    
    const viewportWidth = 1400
    const viewportHeight = 1000
    
    const contextOptions: any = {
      viewport: { width: viewportWidth, height: viewportHeight },
      userAgent: useFingerprint && profile 
        ? profile.navigator.userAgent 
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      deviceScaleFactor: 1
    }
    
    if (useFingerprint && profile) {
      contextOptions.locale = profile.navigator.language
      contextOptions.timezoneId = profile.timezone.name
      if (profile.geolocation) {
        contextOptions.geolocation = profile.geolocation
        contextOptions.permissions = ['geolocation']
      }
    }
    
    if (incognitoMode) {
      contextOptions.acceptDownloads = false
      contextOptions.ignoreHTTPSErrors = false
    }
    
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    
    if (useFingerprint && profile) {
      log('[Fingerprint] Injecting advanced fingerprint script...')
      const { FingerprintInjector } = await import('./fingerprint/injector')
      const injector = new FingerprintInjector()
      const injectionCode = injector.generateInjectionCode(profile)
      
      await page.addInitScript(injectionCode)
      log('[Fingerprint] ✓ Fingerprint script injected')
    }
    
    const registerUrl = verificationUri || 'https://view.awsapps.com/start/#/device?user_code=PQCF-FCCN'
    log(`Registration URL: ${registerUrl}`)
    if (userCode) {
      log(`User Code: ${userCode}`)
    }
    
    await page.goto(registerUrl, { waitUntil: 'networkidle', timeout: 60000 })
    
    // Wait for potential redirect to workflow format
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    const isWorkflowFormat = currentUrl.includes('workflowID') || currentUrl.includes('profile.aws.amazon.com')
    log(`Current URL: ${currentUrl}`)
    log(`URL format: ${isWorkflowFormat ? 'Workflow (new)' : 'Device code (old)'}`)
    
    log(`✓ Page loaded${incognitoMode ? '（Incognito mode）' : ''}${useFingerprint ? '（fingerprint applied）' : ''}`)
    
    await simulatePreRegistrationBehavior(page, log)
    
    // Try multiple email input selectors
    const emailInputSelectors = [
      'input[placeholder="username@example.com"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]'
    ]
    
    let emailFilled = false
    for (const selector of emailInputSelectors) {
      if (await waitAndFill(page, selector, email, log, 'Email input field')) {
        emailFilled = true
        break
      }
    }
    
    if (!emailFilled) {
      throw new Error('Not foundEmail input field')
    }
    
    await page.waitForTimeout(1000)
    
    // Check if name field appears (workflow format)
    const nameInputSelectors = [
      'input[placeholder="Maria José Silva"]',
      'input[name="name"]',
      'input[autocomplete="name"]',
      'input[type="text"]'
    ]
    
    let nameFieldVisible = false
    let nameFilled = false
    for (const selector of nameInputSelectors) {
      try {
        nameFieldVisible = await page.locator(selector).first().isVisible({ timeout: 2000 })
        if (nameFieldVisible) {
          log('Detected workflow format: name field visible after email')
          // Fill name field
          const randomName = generateRandomName()
          if (await waitAndFill(page, selector, randomName, log, 'Name input field')) {
            log(`✓ Filled name: ${randomName}`)
            nameFilled = true
            break
          }
        }
      } catch {}
    }
    
    // Now click Continue button
    const firstContinueSelectors = [
      'button[data-testid="signup-next-button"]',
      'button[data-testid="test-primary-button"]',
      'button:has-text("Continue")',
      'button:has-text("Next")',
      'button[type="submit"]'
    ]
    
    let continueClicked = false
    for (const selector of firstContinueSelectors) {
      if (await waitAndClickWithRetry(page, selector, log, 'Continue button')) {
        continueClicked = true
        break
      }
    }
    
    if (!continueClicked) {
      throw new Error('Click failed')
    }
    
    await page.waitForTimeout(3000)
    
    const loginHeadingSelector = 'span[class*="awsui_heading-text"]:has-text("Sign in with your AWS Builder ID")'
    const verifyHeadingSelector = 'span[class*="awsui_heading-text"]:has-text("Verify")'
    const verifyCodeInputSelector = 'input[placeholder="6-digit"]'
    const nameInputSelector = 'input[placeholder="Maria José Silva"]'
    
    let isLoginFlow = false
    let isVerifyFlow = false
    
    try {
      const loginHeading = page.locator(loginHeadingSelector).first()
      const verifyHeading = page.locator(verifyHeadingSelector).first()
      const verifyCodeInput = page.locator(verifyCodeInputSelector).first()
      const nameInput = page.locator(nameInputSelector).first()
      
      const result = await Promise.race([
        loginHeading.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'login'),
        verifyHeading.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'verify'),
        verifyCodeInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'verify-input'),
        nameInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'register')
      ])
      
      if (result === 'login') {
        isLoginFlow = true
      } else if (result === 'verify' || result === 'verify-input') {
        isLoginFlow = true
        isVerifyFlow = true
      }
    } catch {
      try {
        await page.locator(loginHeadingSelector).first().waitFor({ state: 'visible', timeout: 3000 })
        isLoginFlow = true
      } catch {
        try {
          const hasVerify = await page.locator(verifyHeadingSelector).first().isVisible().catch(() => false)
          const hasVerifyInput = await page.locator(verifyCodeInputSelector).first().isVisible().catch(() => false)
          if (hasVerify || hasVerifyInput) {
            isLoginFlow = true
            isVerifyFlow = true
          }
        } catch {
          isLoginFlow = false
        }
      }
    }
    
    if (isLoginFlow) {
      if (isVerifyFlow) {
        log('\n⚠ 检测到验证页面，Email已注册，直接进入verification codeStep...')
      } else {
        log('\n⚠ 检测到Email已注册，切换到login流程...')
      }
      
      if (!isVerifyFlow) {
        log('\nStep2(login): 输入Password...')
        const loginPasswordSelector = 'input[placeholder="Enter password"]'
        if (!await waitAndFill(page, loginPasswordSelector, password, log, 'loginPassword input field')) {
          throw new Error('Not foundloginPassword input field')
        }
        
        await page.waitForTimeout(1000)
        
        const loginContinueSelector = 'button[data-testid="test-primary-button"]'
        if (!await waitAndClickWithRetry(page, loginContinueSelector, log, 'login继续按钮')) {
          throw new Error('Click failed')
        }
        
        await page.waitForTimeout(3000)
      }
      
      log('\nStep3(login): Get and enter verification code...')
      const loginCodeSelectors = [
        'input[placeholder="6-digit"]',
        'input[placeholder="6 位数"]',
        'input[class*="awsui_input"][type="text"]'
      ]
      
      let loginCodeInput: string | null = null
      for (const selector of loginCodeSelectors) {
        try {
          await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 })
          loginCodeInput = selector
          log('✓ loginverification code input field已to appear')
          break
        } catch {
          continue
        }
      }
      
      if (!loginCodeInput) {
        throw new Error('Not foundloginverification code input field')
      }
      
      await page.waitForTimeout(1000)
      
      let loginVerificationCode: string | null = null
      if (useTempMail) {
        loginVerificationCode = await getTempMailCode(tempMailToken, email, log, 120)
      } else if (refreshToken && clientId) {
        loginVerificationCode = await getOutlookVerificationCode(refreshToken, clientId, log, 120)
      } else {
        log('Missing refresh_token or client_id, cannot auto-get verification code')
      }
      
      if (!loginVerificationCode) {
        throw new Error('无法获取loginverification code')
      }
      
      if (!await waitAndFill(page, loginCodeInput, loginVerificationCode, log, 'loginverification code')) {
        throw new Error('输入loginverification code失败')
      }
      
      await page.waitForTimeout(1000)
      
      const loginVerifySelector = 'button[data-testid="test-primary-button"]'
      if (!await waitAndClickWithRetry(page, loginVerifySelector, log, 'loginverification code确认按钮')) {
        throw new Error('Click failed')
      }
      
      await page.waitForTimeout(5000)
      
    } else if (!nameFilled) {
      // Only enter name if not already filled in workflow format
      log('\nStep2: Enter Name...')
      if (!await waitAndFill(page, nameInputSelector, randomName, log, 'Name input field')) {
        throw new Error('Not foundName input field')
      }
      
      await page.waitForTimeout(1000)
      
      const secondContinueSelector = 'button[data-testid="signup-next-button"]'
      if (!await waitAndClickWithRetry(page, secondContinueSelector, log, 'Second continue button')) {
        throw new Error('Click failed')
      }
      
      await page.waitForTimeout(3000)
    } else {
      log('\nSkipping Step 2: Name already filled in workflow format')
      await page.waitForTimeout(3000)
    }
    
    if (!isLoginFlow) {
      log('\nStep3: Get and enter verification code...')
      const codeInputSelectors = [
        'input[placeholder="6-digit"]',
        'input[placeholder="6 位数"]',
        'input[class*="awsui_input"][type="text"]'
      ]
      
      log('Waiting forverification code input fieldto appear...')
      let codeInputSelector: string | null = null
      for (const selector of codeInputSelectors) {
        try {
          await page.locator(selector).first().waitFor({ state: 'visible', timeout: 30000 })
          codeInputSelector = selector
          log(`✓ verification code input field已to appear (selector: ${selector})`)
          break
        } catch {
          continue
        }
      }
      
      if (!codeInputSelector) {
        throw new Error('未Found verification code input field')
      }
      
      await page.waitForTimeout(1000)
      
      let verificationCode: string | null = null
      if (useTempMail) {
        verificationCode = await getTempMailCode(tempMailToken, email, log, 120)
      } else if (refreshToken && clientId) {
        verificationCode = await getOutlookVerificationCode(refreshToken, clientId, log, 120)
      } else {
        log('Missing refresh_token or client_id, cannot auto-get verification code')
      }
      
      if (!verificationCode) {
        throw new Error('无法获取verification code')
      }
      
      if (!await waitAndFill(page, codeInputSelector, verificationCode, log, 'verification code')) {
        throw new Error('输入verification code失败')
      }
      
      await page.waitForTimeout(1000)
      
      log('检查并处理 Cookie 弹窗...')
      const cookieAcceptSelectors = [
        'button:has-text("Accept")',
        'button:has-text("接受")',
        'button[id*="accept"]',
        'button[class*="accept"]'
      ]
      
      for (const selector of cookieAcceptSelectors) {
        try {
          const cookieButton = page.locator(selector).first()
          if (await cookieButton.isVisible({ timeout: 2000 })) {
            await cookieButton.click()
            log('✓ Clicked Cookie Accept 按钮')
            await page.waitForTimeout(1000)
            break
          }
        } catch {
        }
      }
      
      // ========== verification code提交Step的额外处理 ==========
      // 这Yes唯一需要额外处理的Step
      log('\n[特殊处理] verification code提交Step - 增加重试和验证...')
      
      const verifyButtonSelector = 'button[data-testid="email-verification-verify-button"]'
      const passwordInputSelector = 'input[placeholder="Enter password"]'
      
      // 点击 Continue 按钮
      if (!await waitAndClickWithRetry(page, verifyButtonSelector, log, 'Continue 按钮', 30000, 10)) {
        throw new Error('Click failed')
      }
      
      // 验证YesNo成功进入Password输入页面
      await page.waitForTimeout(3000)
      let passwordPageAppeared = false
      const maxVerifyRetries = 15
      
      for (let retry = 0; retry < maxVerifyRetries; retry++) {
        try {
          const passwordInput = page.locator(passwordInputSelector).first()
          const isVisible = await passwordInput.isVisible({ timeout: 5000 })
          if (isVisible) {
            log(`✓ Password输入页面已to appear（Attempt${retry + 1}次检查）`)
            passwordPageAppeared = true
            break
          }
        } catch {
        }
        
        if (!passwordPageAppeared) {
          const errorVisible = await page.locator('div[class*="awsui_content_"]').first().isVisible({ timeout: 2000 }).catch(() => false)
          const stillOnCodePage = await page.locator('input[placeholder="6-digit"]').first().isVisible({ timeout: 2000 }).catch(() => false)
          
          if (errorVisible || stillOnCodePage) {
            log(`⚠ 检测到仍在verification code页面或有错误弹窗（Attempt${retry + 1}/${maxVerifyRetries}次），Waiting for后重试...`)
            
            const closeBtn = page.locator('button[aria-label="关闭"], button[aria-label="Close"]').first()
            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await closeBtn.click()
              log('✓ Error popup closed')
            }
            
            await page.waitForTimeout(5000)
            await waitAndClickWithRetry(page, verifyButtonSelector, log, 'Continue 按钮（重试）', 10000, 1)
            await page.waitForTimeout(8000)
          } else {
            log(`Waiting forPassword input fieldto appear...（Attempt${retry + 1}/${maxVerifyRetries}次）`)
            await page.waitForTimeout(3000)
          }
        }
      }
      
      if (!passwordPageAppeared) {
        log('✗ 多次重试后Password input field仍未to appear，可能卡在了verification codeStep')
        throw new Error('verification code提交失败，无法进入Password输入Step（可能被 AWS Anti-detection拦截）')
      }
      
      // Step4: Waiting forPassword input fieldto appear，输入Password
      log('\nStep4: 输入Password...')
      
      const passwordInputSelectors = [
        'input[placeholder="Enter password"]',
        'input[placeholder="Create password"]',
        'input[placeholder="Password"]',
        'input[type="password"]',
        'input[name="password"]',
        'input[id*="password"]'
      ]
      
      let passwordFilled = false
      for (const selector of passwordInputSelectors) {
        try {
          const element = page.locator(selector).first()
          await element.waitFor({ state: 'visible', timeout: 10000 })
          log(`✓ 找到Password input field: ${selector}`)
          
          await page.waitForTimeout(500)
          await element.clear()
          await element.fill(password)
          
          log('✓ EnteredPassword')
          passwordFilled = true
          break
        } catch (e) {
          log(`⚠ 选择器 ${selector} Operation failed: ${e}`)
          continue
        }
      }
      
      if (!passwordFilled) {
        throw new Error('Not foundPassword input field')
      }
      
      await page.waitForTimeout(500)
      
      const confirmPasswordSelectors = [
        'input[placeholder="Re-enter password"]',
        'input[placeholder="Confirm password"]',
        'input[placeholder="Confirm Password"]',
        'input[type="password"]:nth-of-type(2)',
        'input[name="confirmPassword"]',
        'input[id*="confirm"]'
      ]
      
      let confirmPasswordFilled = false
      for (const selector of confirmPasswordSelectors) {
        try {
          const element = page.locator(selector).first()
          await element.waitFor({ state: 'visible', timeout: 10000 })
          log(`✓ 找到确认Password input field: ${selector}`)
          
          await page.waitForTimeout(500)
          await element.clear()
          await element.fill(password)
          
          log('✓ Entered确认Password')
          confirmPasswordFilled = true
          break
        } catch {
          continue
        }
      }
      
      if (!confirmPasswordFilled) {
        throw new Error('Not found确认Password input field')
      }
      
      await page.waitForTimeout(1000)
      
      const thirdContinueSelector = 'button[data-testid="test-primary-button"]'
      if (!await waitAndClickWithRetry(page, thirdContinueSelector, log, 'Attempt三个继续按钮（Confirm）')) {
        throw new Error('Click failed')
      }
      
      await page.waitForTimeout(5000)
    }
    
    log('\nStep5: Waiting for授权请求页面（Authorization requested）...')
    const authConfirmSelectors = [
      'button:has-text("Confirm and continue")',
      'button:has-text("确认并继续")',
      'button[data-testid="confirm-button"]',
      'button.awsui-button-variant-primary:has-text("Confirm")'
    ]
    
    let authConfirmed = false
    for (const selector of authConfirmSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 20000 })
        await page.waitForTimeout(1000)
        await element.click()
        log('✓ Clicked "Confirm and continue" 授权按钮')
        authConfirmed = true
        break
      } catch {
        continue
      }
    }
    
    if (!authConfirmed) {
      log('⚠ Not found授权确认按钮，可能已自动授权或页面结构变化')
    }
    
    await page.waitForTimeout(5000)
    
    log('\nStep6: Waiting for访问授权页面（Allow access）...')
    const allowAccessSelectors = [
      'button:has-text("Allow access")',
      'button:has-text("允许访问")',
      'button[data-testid="allow-access-button"]',
      'button.awsui-button-variant-primary:has-text("Allow")'
    ]
    
    let accessAllowed = false
    for (const selector of allowAccessSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 20000 })
        await page.waitForTimeout(1000)
        await element.click()
        log('✓ Clicked "Allow access" 按钮')
        accessAllowed = true
        break
      } catch {
        continue
      }
    }
    
    if (!accessAllowed) {
      log('⚠ Not found "Allow access" 按钮，可能已自动授权或页面结构变化')
    }
    
    log('Waiting for授权处理完成...')
    await page.waitForTimeout(10000)
    
    log('\nStep7: Waiting for授权完全完成...')
    
    const successIndicators = [
      'text=Authorization successful',
      'text=授权成功',
      'text=You may now close this window',
      'text=您现在可以关闭此窗口',
      'text=You are now signed in',
      'text=您现在已login',
      '[data-testid="success-message"]',
      '.awsui-alert-success'
    ]
    
    let authCompleted = false
    let ssoTokenFound = false
    let waitAfterCookie = 0
    
    for (let i = 0; i < 90; i++) {
      for (const indicator of successIndicators) {
        try {
          const element = page.locator(indicator).first()
          if (await element.isVisible({ timeout: 1000 })) {
            log(`✓ 检测到授权成功指示器: ${indicator}`)
            authCompleted = true
            break
          }
        } catch {
          continue
        }
      }
      
      if (authCompleted) break
      
      const currentUrl = page.url()
      if (currentUrl.includes('/start') && !currentUrl.includes('/device') && !currentUrl.includes('/signup')) {
        log(`✓ 页面已跳转到成功页面: ${currentUrl}`)
        authCompleted = true
        break
      }
      
      const cookies = await context.cookies()
      const ssoCookie = cookies.find(c => c.name === 'x-amz-sso_authn')
      if (ssoCookie) {
        if (!ssoTokenFound) {
          log(`✓ 检测到 SSO Cookie，继续Waiting for授权完全完成...`)
          ssoTokenFound = true
        }
        waitAfterCookie++
        
        if (waitAfterCookie >= 15) {
          log(`✓ SSO Cookie 已稳定 ${waitAfterCookie} 秒，授权应该已完成`)
          authCompleted = true
          break
        }
      }
      
      log(`Waiting for授权完成... (${i + 1}/90)${ssoTokenFound ? ` [Cookie 已获取 ${waitAfterCookie}s]` : ''}`)
      await page.waitForTimeout(1000)
    }
    
    if (!authCompleted) {
      throw new Error('授权未完成或超时')
    }
    
    log('\nStep6: 获取 SSO Token...')
    let ssoToken: string | null = null
    const cookies = await context.cookies()
    const ssoCookie = cookies.find(c => c.name === 'x-amz-sso_authn')
    if (ssoCookie) {
      ssoToken = ssoCookie.value
      log(`✓ 成功获取 SSO Token: ${ssoToken.substring(0, 50)}...`)
    }
    
    await browser.close()
    browser = null
    
    if (ssoToken) {
      log('\n========== 操作成功! ==========')
      return { success: true, ssoToken, name: randomName, email: email, password: password }
    } else {
      throw new Error('未能获取 SSO Token，可能操作未完成')
    }
    
  } catch (error) {
    log(`\n✗ Registration failed: ${error}`)
    if (browser) {
      try {
        let page: Page | null = null
        try {
          const contexts = browser.contexts()
          if (contexts.length > 0) {
            const pages = contexts[0].pages()
            page = pages[0] || null
          }
        } catch {}
        await browser.close()
      } catch (e) {
        log(`关闭浏览器时出错: ${e}`)
      }
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type TempMailRegisterOptions = {
  log: LogCallback
  proxyUrl?: string
  customEmail?: string
  incognitoMode?: boolean
  userCode?: string
  verificationUri?: string
  useFingerprint?: boolean
  fingerprintProfile?: any
}

export async function registerAwsBuilderIdTempMail(
  options: TempMailRegisterOptions
): Promise<{ success: boolean; ssoToken?: string; name?: string; error?: string; email?: string; password?: string }> {
  return await autoRegisterAWS(
    options.customEmail,
    undefined,
    undefined,
    options.log,
    undefined,
    true,
    options.proxyUrl,
    options.incognitoMode ?? true,
    true,
    options.userCode,
    options.verificationUri,
    options.useFingerprint ?? true,
    options.fingerprintProfile
  )
}

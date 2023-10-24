const path = require('path')
const log = require('@whi/stdlog')(path.basename(__filename), {
  level: process.env.LOG_LEVEL || 'fatal'
})

const expect = require('chai').expect
const puppeteer = require('puppeteer')

const http_servers = require('../setup.js')

let browser

async function create_page (url) {
  const page = await browser.newPage()

  page.on('console', async msg => {
    log.silly('From puppeteer: console.log( %s )', msg.text())
  })

  log.info('Go to: %s', url)
  await page.goto(url, { waitUntil: 'networkidle0' })

  return page
}

class PageTestUtils {
  constructor (page) {
    this.logPageErrors = () =>
      page.on('pageerror', async error => {
        if (error instanceof Error) {
          log.silly(error.message)
        } else log.silly(error)
      })

    this.describeJsHandleLogs = () =>
      page.on('console', async msg => {
        try {
          const args = await Promise.all(
            msg.args().map(arg => this.describeJsHandle(arg))
          )
          console.log(...args)
        } catch (e) {
          console.log(
            'Could not asynchronously forward console logs from Puppeteer:',
            e
          )
        }
      })

    this.describeJsHandle = async jsHandle => {
      try {
        return await jsHandle
          .executionContext()
          .evaluate(arg => (arg instanceof Error ? arg.message : arg), jsHandle)
      } catch (e) {
        if (e.toString().includes('Target closed')) {
          // Page was closed before we could load the message
          return '<page closed>'
        }
        throw e
      }
    }
  }
}

describe('Testing COMB', function () {
  let setup, happ_host, chap_host, happ_url, chap_url, page, pageTestUtils

  before('Start servers and browser', async () => {
    setup = http_servers()
    browser = await puppeteer.launch()

    log.debug('Setup config: %s', setup.ports)

    happ_host = `http://localhost:${setup.ports.happ}`
    chap_host = `http://localhost:${setup.ports.chaperone}`

    happ_url = `${happ_host}/index.html`
    chap_url = `${chap_host}/index.html`
  })

  beforeEach(async () => {
    page = await create_page(happ_url)
    pageTestUtils = new PageTestUtils(page)

    pageTestUtils.logPageErrors()
    pageTestUtils.describeJsHandleLogs()
  })

  afterEach(async () => {
    await page.close()
  })

  after('Close servers and browser', async () => {
    log.debug('Shutdown cleanly...')
    await browser.close()
    await setup.close()
  })

  it('should insert Chaperone iframe into hApp window', async function () {
    await page.evaluate(async function (frame_url) {
      const child = await COMB.connect(frame_url)
    }, chap_url)

    const parent = page.mainFrame()
    const frames = parent.childFrames()
    log.debug('Frames: %s', frames.length)

    expect(frames.length).to.equal(1)

    const chap_frame = frames[0]

    expect(frames[0].url()).to.equal(chap_url)
  })

  it('should call method on child and await response', async function () {
    let answer

    answer = await page.evaluate(async function (frame_url) {
      window.child = await COMB.connect(frame_url)
      const resp = await child.run('test', 'counting', [1, 2, 3], 4)
      return resp
    }, chap_url)

    expect(answer).to.equal('Hello World: ["counting",[1,2,3],4]')

    answer = await page.evaluate(async function (frame_url) {
      window.child = await COMB.connect(frame_url)
      return await child.run('test_synchronous')
    }, chap_url)

    expect(answer).to.equal('Hello World')
  })

  it('can pass through a Uint8Array', async function () {
    const answer = await page.evaluate(async function (frame_url) {
      window.child = await COMB.connect(frame_url)
      const resp = await child.run(
        'test_return_verbatim',
        new Uint8Array([0, 3])
      )
      // Puppeteer can't pass through Uint8Arrays
      return {
        isBytes: resp instanceof Uint8Array,
        stringified: resp.toString()
      }
    }, chap_url)
    expect(answer).to.deep.equal({ isBytes: true, stringified: '0,3' })
  })

  it('should call method on child and return error', async function () {
    let answer

    answer = await page.evaluate(async function (frame_url) {
      window.child = await COMB.connect(frame_url)
      try {
        await child.call('test_error', 'counting', [1, 2, 3], 4)
      } catch (err) {
        console.log('Caught expected error:', err)
        return err.toString()
      }
    }, chap_url)

    expect(answer).to.equal(
      'HolochainTestError: Method did not succeed\n["counting",[1,2,3],4]'
    )

    answer = await page.evaluate(async function (frame_url) {
      window.child = await COMB.connect(frame_url)
      try {
        return await child.run('test_synchronous_error')
      } catch (err) {
        console.log('Caught expected error:', err)
        return err.toString()
      }
    }, chap_url)

    expect(answer).to.equal('HolochainTestError: Method did not succeed')
  })

  it('should set key/value on child and await confirmation', async function () {
    const answer = await page.evaluate(async function (frame_url) {
      const child = await COMB.connect(frame_url)
      return await child.set('mode', 'develop')
    }, chap_url)

    expect(answer).to.be.null
  })

  it('should call the provided signalCb when sendSignal is called on the parent', async function () {
    // have to setup our spy function in the puppeteer evaluation context
    await page.evaluate(() => {
      window.signalCb = function (signal) {
        window.signalCbCalledWith = signal
      }
    })

    const expectedSignal = 'Hello COMB'

    const signalCbCalledWith = await page.evaluate(
      async function (chap_url, expectedSignal) {
        window.child = await COMB.connect(chap_url, 5000, window.signalCb)
        await child.run('test_signal', expectedSignal)
        return window.signalCbCalledWith
      },
      chap_url,
      expectedSignal
    )

    expect(signalCbCalledWith).to.equal(expectedSignal)
  })

  it('can emit signal containing Uint8Array', async function () {
    // have to setup our spy function in the puppeteer evaluation context
    await page.evaluate(() => {
      window.signalCb = function (signal) {
        window.signalCbCalledWith = signal
      }
    })

    const answer = await page.evaluate(async function (chap_url) {
      window.child = await COMB.connect(chap_url, document.body, 5000, window.signalCb)
      await child.run('test_signal', new Uint8Array([1, 4]))
      const signalEmitted = window.signalCbCalledWith
      // Puppeteer can't pass through Uint8Arrays
      return {
        isBytes: signalEmitted instanceof Uint8Array,
        stringified: signalEmitted.toString()
      }
    }, chap_url)

    expect(answer).to.deep.equal({ isBytes: true, stringified: '1,4' })
  })

  it('should timeout because of wrong frame URL', async function () {
    const result = await page.evaluate(async function () {
      try {
        await COMB.connect('http://localhost:55555', document.body, 500)
      } catch (err) {
        console.log('Caught expected error:', err)
        return err.toString()
      }
    })
    log.debug('Error result: %s', result)

    expect(result).to.equal('TimeoutError: Failed to load iFrame')
  })

  it('should timeout because COMB is not listening', async function () {
    const fail_url = `${chap_host}/comb_not_listening.html`

    const result = await page.evaluate(async function (frame_url) {
      try {
        await COMB.connect(frame_url, document.body, 500)
      } catch (err) {
        console.log('Caught expected error:', err)
        return err.toString()
      }
    }, fail_url)

    expect(result).to.equal('TimeoutError: Failed to load iFrame')
  })

  it("should timeout because method didn't respond", async function () {
    const fail_url = `${chap_host}/comb_method_no_response.html`

    const result = await page.evaluate(async function (frame_url) {
      try {
        const child = await COMB.connect(frame_url)
        await child.run('timeout')
      } catch (err) {
        console.log('Caught expected error:', err)
        return err.toString()
      }
    }, fail_url)

    expect(result).to.equal('TimeoutError: Waited for 2 seconds')
  })

  it('should not timeout because of long call', async function () {
    const pass_url = `${chap_host}/comb_method_long_wait.html`

    const result = await page.evaluate(async function (frame_url) {
      const child = await COMB.connect(frame_url)
      return await child.call('long_call')
    }, pass_url)

    expect(result).to.equal('Hello World')
  })

  it('should throw error because method does not exist', async function () {
    const fail_url = `${chap_host}/comb_method_does_not_exist.html`

    const result = await page.evaluate(async function (frame_url) {
      try {
        const child = await COMB.connect(frame_url)
        await child.run('undefined_method')
      } catch (err) {
        console.log('Caught expected error:', err)
        return err.toString()
      }
    }, fail_url)

    expect(result).to.equal("Method 'undefined_method' does not exist")
  })

  it('should throw error because method is not a function', async function () {
    const fail_url = `${chap_host}/comb_method_is_not_a_function.html`

    const result = await page.evaluate(async function (frame_url) {
      try {
        const child = await COMB.connect(frame_url)
        await child.run('not_a_function')
      } catch (err) {
        console.log('Caught expected error:', err)
        return err.toString()
      }
    }, fail_url)

    expect(result).to.equal(
      "Method 'not_a_function' is not a function. Found type 'object'"
    )
  })

  it('should not emit any console.log messages', async function () {
    const no_debug_happ_url = `${happ_host}/comb_no_debug.html`
    const no_debug_chap_url = `${chap_host}/comb_no_debug.html`

    const newPage = await browser.newPage()

    let no_logs = true
    newPage.on('console', async msg => {
      log.silly('From puppeteer: console.log( %s )', msg.text())
      no_logs = false
    })

    log.info('Go to: %s', no_debug_happ_url)
    await newPage.goto(no_debug_happ_url, { waitUntil: 'networkidle0' })

    try {
      newPage.on('console', async msg => {
        log.silly('From puppeteer: console.log( %s )', msg.text())
      })

      const answer = await newPage.evaluate(async function (frame_url) {
        const child = await COMB.connect(frame_url)
        return await child.run('test')
      }, no_debug_chap_url)

      expect(answer).to.equal('Hello World')
      expect(no_logs).to.be.true
    } finally {
      await newPage.close()
    }
  })
})

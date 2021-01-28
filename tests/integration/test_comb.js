const path = require('path');
const log = require('@whi/stdlog')(path.basename(__filename), {
  level: process.env.LOG_LEVEL || 'fatal',
});

const expect = require('chai').expect;
const puppeteer = require('puppeteer');

const http_servers = require('../setup.js');

let browser;

async function create_page(url) {
  const page = await browser.newPage();

  page.on("console", async (msg) => {
    log.silly("From puppeteer: console.log( %s )", msg.text());
  });

  log.info("Go to: %s", url);
  await page.goto(url, { "waitUntil": "networkidle0" });

  return page;
}

class PageTestUtils {
  constructor(page) {
    this.logPageErrors = () => page.on('pageerror', async error => {
      if (error instanceof Error) {
        log.silly(error.message);
      }
      else
        log.silly(error);
    });

    this.describeJsHandleLogs = () => page.on('console', async msg => {
      const args = await Promise.all(msg.args().map(arg => this.describeJsHandle(arg)))
        .catch(error => console.log(error.message));
      console.log(...args);
    });

    this.describeJsHandle = (jsHandle) => {
      return jsHandle.executionContext().evaluate(arg => {
        if (arg instanceof Error)
          return arg.message;
        else
          return arg;
      }, jsHandle);
    };
  }
}

describe("Testing COMB", function () {
  let setup, happ_host, chap_host, happ_url, chap_url, page, pageTestUtils;

  before("Start servers and browser", async () => {
    setup = http_servers();
    browser = await puppeteer.launch();

    log.debug("Setup config: %s", setup.ports);

    happ_host = `http://localhost:${setup.ports.happ}`;
    chap_host = `http://localhost:${setup.ports.chaperone}`;

    happ_url = `${happ_host}/index.html`
    chap_url = `${chap_host}/index.html`
  });

  beforeEach(async () => {
    page = await create_page(happ_url);
    pageTestUtils = new PageTestUtils(page)

    pageTestUtils.logPageErrors()
  });

  afterEach(async () => {
    await page.close();
  })

  after("Close servers and browser", async () => {
    log.debug("Shutdown cleanly...");
    await browser.close();
    await setup.close();
  });

  it("should insert Chaperone iframe into hApp window", async function () {
    try {
      await page.evaluate(async function (frame_url) {
        const child = await COMB.connect(frame_url);
      }, chap_url);

      const parent = page.mainFrame();
      const frames = parent.childFrames();
      log.debug("Frames: %s", frames.length);

      expect(frames.length).to.equal(1);

      const chap_frame = frames[0];

      expect(frames[0].url()).to.equal(chap_url);
    } finally {
    }
  });

  it("should call method on child and await response", async function () {
    let answer;
    try {
      answer = await page.evaluate(async function (frame_url) {
        window.child = await COMB.connect(frame_url);
        return await child.run("test", "counting", [1, 2, 3], 4);
      }, chap_url);

      expect(answer).to.equal("Hello World: [\"counting\",[1,2,3],4]");


      answer = await page.evaluate(async function (frame_url) {
        window.child = await COMB.connect(frame_url);
        return await child.run("test_synchronous");
      }, chap_url);

      expect(answer).to.equal("Hello World");
    } finally {
    }
  });

  it("should call method on child and return error", async function () {
    pageTestUtils.describeJsHandleLogs()
    let answer;
    try {
      answer = await page.evaluate(async function (frame_url) {
        window.child = await COMB.connect(frame_url);
        return await child.call("test_error", "counting", [1, 2, 3], 4);
      }, chap_url);

      expect(answer.name).to.equal("HolochainTestError");
      expect(answer.message).to.equal("Method did not succeed\n[\"counting\",[1,2,3],4]");


      answer = await page.evaluate(async function (frame_url) {
        window.child = await COMB.connect(frame_url);
        return await child.run("test_synchronous_error");
      }, chap_url);

      expect(answer.name).to.equal("HolochainTestError");
      expect(answer.message).to.equal("Method did not succeed");
    } finally {
    }
  });

  it("should set key/value on child and await confirmation", async function () {
    try {
      const answer = await page.evaluate(async function (frame_url) {
        const child = await COMB.connect(frame_url);
        return await child.set("mode", "develop");
      }, chap_url);

      expect(answer).to.be.true;
    } finally {
    }
  });

  it("should timeout because of wrong frame URL", async function () {
    try {
      const result = await page.evaluate(async function () {
        try {
          await COMB.connect("http://localhost:55555", 500);
        } catch (err) {
          console.log("Error message value:", err.message);
          return {
            "name": err.name,
            "message": err.message,
          };
        }
      });
      log.debug("Error result: %s", result);

      expect(result.name).to.equal("TimeoutError");
      expect(result.message).to.equal("Failed to load iFrame");
    } finally {
    }
  });

  it("should timeout because COMB is not listening", async function () {
    const fail_url = `${chap_host}/comb_not_listening.html`
    try {
      const result = await page.evaluate(async function (frame_url) {
        try {
          await COMB.connect(frame_url, 500);
        } catch (err) {
          console.log("Error message value:", err.message);
          return {
            "name": err.name,
            "message": err.message,
          };
        }
      }, fail_url);

      expect(result.name).to.equal("TimeoutError");
      expect(result.message).to.equal("Failed to load iFrame");
    } finally {
    }
  });

  it("should timeout because method didn't respond", async function () {
    const fail_url = `${chap_host}/comb_method_no_response.html`
    try {
      const result = await page.evaluate(async function (frame_url) {
        try {
          const child = await COMB.connect(frame_url);
          await child.run("timeout");
        } catch (err) {
          console.log("Error message value:", err.message);
          return {
            "name": err.name,
            "message": err.message,
          };
        }
      }, fail_url);

      expect(result.name).to.equal("TimeoutError");
      expect(result.message).to.equal("Waited for 2 seconds");
    } finally {
    }
  });

  it("should not timeout because of long call", async function () {
    const pass_url = `${chap_host}/comb_method_long_wait.html`
    try {
      const result = await page.evaluate(async function (frame_url) {
        const child = await COMB.connect(frame_url);
        return await child.call("long_call");
      }, pass_url);

      expect(result).to.equal("Hello World");
    } finally {
    }
  });

  it("should throw error because method does not exist", async function () {
    const fail_url = `${chap_host}/comb_method_does_not_exist.html`
    try {
      const result = await page.evaluate(async function (frame_url) {
        try {
          const child = await COMB.connect(frame_url);
          await child.run("undefined_method");
        } catch (err) {
          console.log("Error message value:", err.message);
          return {
            "name": err.name,
            "message": err.message,
          };
        }
      }, fail_url);

      expect(result.name).to.equal("Error");
      expect(result.message).to.equal("Method 'undefined_method' does not exist");
    } finally {
    }
  });

  it("should throw error because method is not a function", async function () {
    const fail_url = `${chap_host}/comb_method_is_not_a_function.html`
    try {
      const result = await page.evaluate(async function (frame_url) {
        try {
          const child = await COMB.connect(frame_url);
          await child.run("not_a_function");
        } catch (err) {
          console.log("Error message value:", err.message);
          return {
            "name": err.name,
            "message": err.message,
          };
        }
      }, fail_url);

      expect(result.name).to.equal("Error");
      expect(result.message).to.equal("Method 'not_a_function' is not a function. Found type 'object'");
    } finally {
    }
  });

  it("should not emit any console.log messages", async function () {
    const no_debug_happ_url = `${happ_host}/comb_no_debug.html`
    const no_debug_chap_url = `${chap_host}/comb_no_debug.html`

    const newPage = await browser.newPage();

    let no_logs = true;
    newPage.on("console", async (msg) => {
      log.silly("From puppeteer: console.log( %s )", msg.text());
      no_logs = false;
    });

    log.info("Go to: %s", no_debug_happ_url);
    await newPage.goto(no_debug_happ_url, { "waitUntil": "networkidle0" });

    try {
      newPage.on("console", async (msg) => {
        log.silly("From puppeteer: console.log( %s )", msg.text());
      });

      const answer = await newPage.evaluate(async function (frame_url) {
        const child = await COMB.connect(frame_url);
        return await child.run("test");
      }, no_debug_chap_url);

      expect(answer).to.equal("Hello World");
      expect(no_logs).to.be.true;
    } finally {
      await newPage.close();
    }
  });
});

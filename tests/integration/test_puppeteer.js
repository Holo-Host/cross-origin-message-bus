const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const expect				= require('chai').expect;
const puppeteer				= require('puppeteer');

const http_servers			= require('../setup.js');


describe("Testing puppeteer with test servers", function() {
	
    it('should start test servers, connect with puppeteer, then close', async function () {
	const setup			= http_servers();
	log.debug("Setup config: %s", setup.ports );
	const browser			= await puppeteer.launch();
	
	try {
	    const happ_url		= `http://localhost:${setup.ports.happ}/index.html`;
	    
	    log.info("Fetch: %s", happ_url );
	    const page			= await browser.newPage();

	    await page.goto( happ_url );

	    const parent		= page.mainFrame();
	    log.debug("Main frame: %s", parent.constructor.name );
	    
	    const content		= await parent.$eval('#main-content', div => div.innerHTML );
	    log.debug("Content: %s", content );

	    expect( content ).to.equal("Hello World");

	} finally {
	    await browser.close();
	    await setup.close();
	}
    });
    
});

const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const assert				= require('assert');
const axios				= require('axios');
const expect				= require('chai').expect;
const puppeteer				= require('puppeteer');

const http_servers			= require('../setup.js');


describe("Testing COMB", function() {
	
    it('should insert Chaperon iframe into hApp window', async function () {
	// const setup			= http_servers();
	// log.debug("Setup config: %s", setup );

	// try {
	//     const happ_url		= `http://localhost:${setup.ports.happ}/index.html`;
	//     log.info("Fetch: %s", happ_url );
	//     const happ_resp		= await axios.get( happ_url );

	//     expect( happ_resp.status ).to.equal( 200 );
	    
	//     const chap_url		= `http://localhost:${setup.ports.chaperon}/index.html`;
	//     log.info("Fetch: %s", chap_url );
	//     const chap_resp		= await axios.get( chap_url );
	    
	//     expect( chap_resp.status ).to.equal( 200 );
	// } finally {
	//     await setup.close();
	// }
	
	const setup			= http_servers();
	log.debug("Setup config: %s", setup.ports );
	const browser			= await puppeteer.launch();
	
	try {
	    const happ_url		= `http://localhost:${setup.ports.happ}/index.html`;
	    const chap_url		= `http://localhost:${setup.ports.chaperon}/index.html`;
	    
	    const page			= await browser.newPage();
	    
	    log.info("Go to: %s", happ_url );
	    await page.goto( happ_url );

	    log.info("Add Chaperon iFrame: %s", chap_url );
	    await page.evaluate(( url ) => {
		const container		= document.createElement("div");
		container.innerHTML	= `<iframe src="${url}"></iframe>`;

		document.body.appendChild( container );
	    }, chap_url );

	    const parent		= page.mainFrame();
	    const frames		= parent.childFrames();
	    log.debug("Frames: %s", frames.length );

	    expect( frames.length	).to.equal( 1 );
	    
	    const chap_frame		= frames[0];

	    await chap_frame.waitForNavigation();

	    expect( frames[0].url()	).to.equal( chap_url );
	    
	} finally {
	    await browser.close();
	    await setup.close();
	}
    });
    
});

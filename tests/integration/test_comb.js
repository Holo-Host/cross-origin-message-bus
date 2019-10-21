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

    let setup, browser;
	
    before("", async () => {
	setup				= http_servers();
	browser				= await puppeteer.launch();
	
	log.debug("Setup config: %s", setup.ports );
    });

    after("", async () => {
	log.debug("Shutdown cleanly...");
	await browser.close();
	await setup.close();
    });
	
    it('should insert Chaperon iframe into hApp window', async function () {
    	try {
    	    const happ_url		= `http://localhost:${setup.ports.happ}/index.html`;
    	    const chap_url		= `http://localhost:${setup.ports.chaperon}/index.html`;
	    
    	    const page			= await browser.newPage();

    	    page.on("console", async ( msg ) => {
    		log.debug("From puppeteer: console.log( %s )", msg.text() );
    	    });
	    
    	    log.info("Go to: %s", happ_url );
    	    await page.goto( happ_url, { "waitUntil": "networkidle0" } );

	    await page.evaluate(async function ( frame_url )  {
		const child		= await COMB.connect( frame_url );
	    }, chap_url );

    	    const parent		= page.mainFrame();
    	    const frames		= parent.childFrames();
    	    log.debug("Frames: %s", frames.length );

    	    expect( frames.length	).to.equal( 1 );
	    
    	    const chap_frame		= frames[0];

    	    expect( frames[0].url()	).to.equal( chap_url );
    	} finally {
    	}
    });
	
    it('should call method on child and await response', async function () {
	try {
	    const happ_url		= `http://localhost:${setup.ports.happ}/index.html`;
	    const chap_url		= `http://localhost:${setup.ports.chaperon}/index.html`;
	    
	    const page			= await browser.newPage();

	    page.on("console", async ( msg ) => {
		log.debug("From puppeteer: console.log( %s )", msg.text() );
	    });
	    
	    log.info("Go to: %s", happ_url );
	    await page.goto( happ_url, { "waitUntil": "networkidle0" } );

	    const answer		= await page.evaluate(async function ( frame_url )  {
		const child		= await COMB.connect( frame_url );
		return await child.run("test");
	    }, chap_url );

	    expect( answer	).to.equal( "Hello World" );
	} finally {
	}
    });
    
});

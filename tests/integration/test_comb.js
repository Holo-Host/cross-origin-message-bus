const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const expect				= require('chai').expect;
const puppeteer				= require('puppeteer');

const http_servers			= require('../setup.js');


let browser;

async function create_page ( url ) {
    const page				= await browser.newPage();
    
    page.on("console", async ( msg ) => {
    	log.silly("From puppeteer: console.log( %s )", msg.text() );
    });
    
    log.info("Go to: %s", url );
    await page.goto( url, { "waitUntil": "networkidle0" } );

    return page;
}


describe("Testing COMB", function() {

    let setup, happ_host, chap_host;
	
    before("Start servers and browser", async () => {
	setup				= http_servers();
	browser				= await puppeteer.launch();
	
	log.debug("Setup config: %s", setup.ports );

    	happ_host			= `http://localhost:${setup.ports.happ}`;
    	chap_host			= `http://localhost:${setup.ports.chaperon}`;
    });

    after("Close servers and browser", async () => {
	log.debug("Shutdown cleanly...");
	await browser.close();
	await setup.close();
    });
	
    it("should insert Chaperon iframe into hApp window", async function () {
	const happ_url			= `${happ_host}/index.html`
	const chap_url			= `${chap_host}/index.html`

    	const page			= await create_page( happ_url );

    	try {
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
	    await page.close();
    	}
    });
	
    it("should call method on child and await response", async function () {
	const happ_url			= `${happ_host}/index.html`
	const chap_url			= `${chap_host}/index.html`

    	const page			= await create_page( happ_url );

	let answer;
	try {
	    answer			= await page.evaluate(async function ( frame_url )  {
		window.child		= await COMB.connect( frame_url );
		return await child.run("test", "counting", [1,2,3], 4 );
	    }, chap_url );

	    expect( answer		).to.equal( "Hello World: [\"counting\",[1,2,3],4]" );

	    
	    answer			= await page.evaluate(async function ( frame_url )  {
		return await child.run("test_synchronous");
	    }, chap_url );

	    expect( answer		).to.equal( "Hello World" );
	} finally {
	    await page.close();
	}
    });
	
    it("should set key/value on child and await confirmation", async function () {
	const happ_url			= `${happ_host}/index.html`
	const chap_url			= `${chap_host}/index.html`

    	const page			= await create_page( happ_url );

	try {
	    const answer		= await page.evaluate(async function ( frame_url )  {
		const child		= await COMB.connect( frame_url );
		return await child.set("mode", "develop");
	    }, chap_url );

	    expect( answer		).to.be.true;
	} finally {
	    await page.close();
	}
    });
	
    it("should timeout because of wrong frame URL", async function () {
	const happ_url			= `${happ_host}/index.html`

    	const page			= await create_page( happ_url );

	try {
	    const result		= await page.evaluate(async function ()  {
		try {
		    await COMB.connect( "http://localhost:55555" );
		} catch ( err ) {
		    console.log( "Error message value:", err.message );
		    return {
			"name": err.name,
			"message": err.message,
		    };
		}
	    });
	    log.debug("Error result: %s", result );

	    expect( result.name		).to.equal( "TimeoutError" );
	    expect( result.message	).to.equal( "Failed to load iFrame" );
	} finally {
	    await page.close();
	}
    });
	
    it("should timeout because COMB is not listening", async function () {
	const happ_url			= `${happ_host}/index.html`
	const fail_url			= `${chap_host}/comb_not_listening.html`

    	const page			= await create_page( happ_url );

	try {
	    const result		= await page.evaluate(async function ( frame_url )  {
		try {
		    await COMB.connect( frame_url );
		} catch ( err ) {
		    console.log( "Error message value:", err.message );
		    return {
			"name": err.name,
			"message": err.message,
		    };
		}
	    }, fail_url );

	    expect( result.name		).to.equal( "TimeoutError" );
	    expect( result.message	).to.equal( "Failed to load iFrame" );
	} finally {
	    await page.close();
	}
    });
	
    it("should timeout because method didn't respond", async function () {
	const happ_url			= `${happ_host}/index.html`
	const fail_url			= `${chap_host}/comb_method_no_response.html`

    	const page			= await create_page( happ_url );

	try {
	    const result		= await page.evaluate(async function ( frame_url )  {
		try {
		    const child		= await COMB.connect( frame_url );
		    await child.run("timeout");
		} catch ( err ) {
		    console.log( "Error message value:", err.message );
		    return {
			"name": err.name,
			"message": err.message,
		    };
		}
	    }, fail_url );

	    expect( result.name		).to.equal( "TimeoutError" );
	    expect( result.message	).to.equal( "Waited for 1 seconds" );
	} finally {
	    await page.close();
	}
    });
	
    it("should throw error because method does not exist", async function () {
	const happ_url			= `${happ_host}/index.html`
	const fail_url			= `${chap_host}/comb_method_does_not_exist.html`

    	const page			= await create_page( happ_url );

	try {
	    const result		= await page.evaluate(async function ( frame_url )  {
		try {
		    const child		= await COMB.connect( frame_url );
		    await child.run("undefined_method");
		} catch ( err ) {
		    console.log( "Error message value:", err.message );
		    return {
			"name": err.name,
			"message": err.message,
		    };
		}
	    }, fail_url );

	    expect( result.name		).to.equal( "Error" );
	    expect( result.message	).to.equal( "Method 'undefined_method' does not exist" );
	} finally {
	    await page.close();
	}
    });
	
    it("should throw error because method is not a function", async function () {
	const happ_url			= `${happ_host}/index.html`
	const fail_url			= `${chap_host}/comb_method_is_not_a_function.html`

    	const page			= await create_page( happ_url );

	try {
	    const result		= await page.evaluate(async function ( frame_url )  {
		try {
		    const child		= await COMB.connect( frame_url );
		    await child.run("not_a_function");
		} catch ( err ) {
		    console.log( "Error message value:", err.message );
		    return {
			"name": err.name,
			"message": err.message,
		    };
		}
	    }, fail_url );

	    expect( result.name		).to.equal( "Error" );
	    expect( result.message	).to.equal( "Method 'not_a_function' is not a function. Found type 'object'" );
	} finally {
	    await page.close();
	}
    });
	
    it("should not emit any console.log messages", async function () {
	const happ_url			= `${happ_host}/comb_no_debug.html`
	const chap_url			= `${chap_host}/comb_no_debug.html`

	const page			= await browser.newPage();
	
	let no_logs			= true;
	page.on("console", async ( msg ) => {
    	    log.silly("From puppeteer: console.log( %s )", msg.text() );
	    no_logs			= false;
	});
	
	log.info("Go to: %s", happ_url );
	await page.goto( happ_url, { "waitUntil": "networkidle0" } );
	
	try {
	    page.on("console", async ( msg ) => {
    		log.silly("From puppeteer: console.log( %s )", msg.text() );
	    });
	    
	    const answer		= await page.evaluate(async function ( frame_url )  {
		const child		= await COMB.connect( frame_url );
		return await child.run("test");
	    }, chap_url );

	    expect( answer		).to.equal( "Hello World" );
	    expect( no_logs		).to.be.true;
	} finally {
	    await page.close();
	}
    });
	
});

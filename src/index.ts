import Postmate				from 'postmate';

import { logging }			from '@holo-host/service-worker-logger';

const log				= logging.getLogger('COMB');
log.setLevel('debug');

class TimeoutError extends Error {

    timeout	: number;
    
    constructor( message : string, timeout : number, ...params ) {
	// Pass remaining arguments (including vendor specific ones) to parent constructor
	super( message );

	// Maintains proper stack trace for where our error was thrown (only available on V8)
	if ( Error.captureStackTrace ) {
	    Error.captureStackTrace( this, TimeoutError );
	}

	this.name			= 'TimeoutError';
	this.timeout			= timeout;
    }
}

function async_with_timeout ( fn, timeout = 2000 ) : Promise<any> {
    return new Promise(async (f,r) => {
	log.debug("Set timeout async timeout to", timeout );
	const to_id			= setTimeout(() => {
	    log.warn("Triggered async timeout");
	    r( new TimeoutError("Waited for " + (timeout/1000) + " seconds", timeout ) );
	}, timeout);

	try {
	    const result		= await fn();
	    f( result );
	} catch ( err ) {
	    r( err );
	} finally {
	    clearTimeout( to_id );
	}
    });
}


class ChildAPI {

    url		: string;
    msg_count	: number;
    responses	: object;
    msg_bus	: any;

    constructor ( url ) {

	// if ( debug )
	//     Postmate.debug	= true;
	this.url			= url;
	this.msg_count			= 0;
	this.responses			= {};
    }

    async connect () {
	let loaded			= false;
	let chaperon;
	
	try {
	    chaperon			= await async_with_timeout(async () => {
		log.info("Init Postmate handshake");
		const handshake		= new Postmate({
		    "container": document.body,
		    "url": this.url,
		    "classListArray": ["chaperon-frame"],
		});

		const iframe		= document.querySelector('iframe.chaperon-frame');
		log.debug("Listening for iFrame load event", iframe );
		
		iframe['contentWindow'].addEventListener("domcontentloaded", () => {
		    log.debug("iFrame content has loaded");
		    loaded		= true;
		});

		return await handshake;
	    }, 1000 );
	} catch ( err ) {
	    if ( err.name === "TimeoutError" ) {
		if ( loaded ) {
		    log.error("iFrame loaded but could not communicate with COMB");
		    throw new TimeoutError("Failed to complete COMB handshake", err.timeout );
		}
		else {
		    log.error("iFrame did not trigger load event");
		    throw new TimeoutError("Failed to load iFrame", err.timeout );
		}
	    }
	    else
		throw err;
	}
	
	log.info("Finished handshake");
	
	chaperon.on('response', ( data ) => {
	    let [k,v]			= data;
	    log.info("Received response for msg_id:", k );

	    const [f,r]			= this.responses[ k ];

	    if ( v instanceof Error )
		r( v );
	    else
		f( v );
	});

	this.msg_bus			= chaperon;
	
	return this;
    }

    set ( key, value ) {
	null;
    }

    run ( method, data ) {
	let msg_id			= this.msg_count++;
	
	this.msg_bus.call( "exec", [ msg_id, method, data ] );
	log.info("Sent request with msg_id:", msg_id );
	
	return async_with_timeout(async () => {
	    const request		= new Promise((f,r) => {
		this.responses[msg_id]	= [f,r];
	    });
	    
	    return await request;
	}, 1000 );
    }
}


class ParentAPI {

    msg_bus	: any;
    methods	: object;
    
    constructor ( methods ) {
	null;

	this.methods			= methods;
	
	// if ( debug )
	//     Postmate.debug	= true;
    }

    async connect () {
	const parent = await new Postmate.Model({
	    "exec": async ( data ) => {
		const [msg_id, method, ...args] = data;

		const fn		= this.methods[ method ];
		
		if ( fn === undefined ) {
		    log.error("Method does not exist", method );
		    return parent.emit("response", [ msg_id, new Error("Method '"+ method +"' does not exist") ]);
		}
		
		const resp		= await fn.apply( this, args );
		
		parent.emit("response", [ msg_id, resp ]);
	    }
	});

	this.msg_bus			= parent;
	
	return this;
    }
    
}

const COMB = {
    "connect": async function ( url ) {
	const child			= new ChildAPI( url );
	await child.connect();
	return child;
    },
    "listen": async function ( methods ) {
	const parent			= new ParentAPI( methods );
	await parent.connect();
	return parent;
    },
};

export {
    COMB,
}

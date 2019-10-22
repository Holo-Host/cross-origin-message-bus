import { logging }			from '@holo-host/service-worker-logger';

import Postmate				from 'postmate';

import async_with_timeout		from './async_with_timeout';
import { TimeoutError }			from './async_with_timeout';

const log				= logging.getLogger('COMB');
log.setLevel('error');


class ChildAPI {

    url		: string;
    msg_count	: number;
    responses	: object;
    msg_bus	: any;

    constructor ( url ) {
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

    private request ( pm_method, fn_name, data ) {
	let msg_id			= this.msg_count++;
	
	this.msg_bus.call( pm_method, [ msg_id, fn_name, data ] );
	log.info("Sent request with msg_id:", msg_id );
	
	return async_with_timeout(async () => {
	    const request		= new Promise((f,r) => {
		this.responses[msg_id]	= [f,r];
	    });
	    
	    return await request;
	}, 1000 );
    }

    async set ( key, value ) {
	return await this.request( "set_attr", key, value );
    }

    async run ( method, ...args ) {
	return await this.request( "exec", method, args );
    }
}


class ParentAPI {

    msg_bus	: any;
    methods	: object;
    
    constructor ( methods ) {
	this.methods			= methods;
    }

    async connect () {
	const parent = await new Postmate.Model({
	    "exec": async ( data ) => {
		const [msg_id, method, args] = data;

		const fn		= this.methods[ method ];
		
		if ( fn === undefined ) {
		    log.error("Method does not exist", method );
		    return parent.emit("response", [ msg_id, new Error("Method '"+ method +"' does not exist") ]);
		}
		if ( typeof fn !== "function" ) {
		    log.error("Method is not a function: type", typeof fn );
		    return parent.emit("response", [ msg_id, new Error("Method '" + method + "' is not a function. Found type '" + typeof fn + "'") ]);
		}
		
		const resp		= await fn.apply( this.methods, args );
		
		parent.emit("response", [ msg_id, resp ]);
	    },
	    "set_attr": async ( data ) => {
		const [msg_id, key, value] = data;

		const existing_value	= this.methods[ key ];

		if ( typeof existing_value === "function" ) {
		    log.error("Cannot overwrite '"+ key +"' because it is a function");
		    return parent.emit("response", [ msg_id, new Error("Cannot overwrite '" + key + "' because it is a function") ]);
		}
		
		this.methods[ key ]	= value;
		
		parent.emit("response", [ msg_id, true ]);
	    }
	});

	this.msg_bus			= parent;
	
	return this;
    }
    
}

const COMB = {
    "debug": function ( level = 'debug' ) {
	Postmate.debug			= true;
	log.setLevel( level );
    },
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

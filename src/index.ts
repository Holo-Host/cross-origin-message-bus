
import Postmate			from 'postmate';

class ChildAPI {

    url		: string;
    msg_count	: number;
    responses	: object;
    msg_bus	: any;

    constructor ( url ) {

	// if ( debug )
	//     Postmate.debug	= true;
	this.url		= url;
	this.msg_count		= 0;
	this.responses		= {};
    }

    async connect () {
	const chaperon		= await new Postmate({
	    "container": document.body,
	    "url": this.url,
	    "classListArray": ["chaperon-frame"],
	});

	chaperon.on('response', ( data ) => {
	    let [k,v]		= data;
	    this.responses[ k ]( v );
	});

	this.msg_bus		= chaperon;

	return this;
    }

    set ( key, value ) {
	null;
    }

    run ( method, data ) {
	let msg_id		= this.msg_count++;
	
	this.msg_bus.call( "exec", [ msg_id, method, data ] );
	
	return new Promise((f,r) => {
	    this.responses[msg_id]	= f;

	    // TODO: make a timout that calls r
	});
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

		const resp		= await this.methods[ method ].apply( this, args );
		
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

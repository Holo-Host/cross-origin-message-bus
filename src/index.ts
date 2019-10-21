
import Postmate			from 'postmate';

class Child {

    msg_count	: number;
    responses	: object;
    msg_bus	: any;

    constructor ( url ) {

	// if ( debug )
	//     Postmate.debug	= true;
	this.msg_count		= 0;
	this.responses		= {};

	this.init();
    }

    async init () {
	const chaperon		= await new Postmate({
	    "container": document.body,
	    "url": "http://localhost:4532/index.html",
	    "classListArray": ["chaperon-frame"],
	});

	chaperon.on('response', ( data ) => {
	    let [k,v]		= data;
	    this.responses[ k ]( v );
	});

	this.msg_bus		= chaperon;

	return chaperon;
    }

    set ( key, value ) {
	null;
    }

    run ( method, data ) {
	let msg_id		= this.msg_count++;
	
	this.msg_bus.call( method, [ msg_id, data ] );
	
	return new Promise((f,r) => {
	    this.responses[msg_id]	= f;

	    // TODO: make a timout that calls r
	});
    }
}


class Parent {

    constructor ( methods ) {
	null;
	
	// if ( debug )
	//     Postmate.debug	= true;
    }

    async init () {
	const parent = await new Postmate.Model({
	    "init": async function ( data ) {
		const [msg_id, mode] = data;
		
		console.log( mode );

		parent.emit("response", [ msg_id, true ]);
	    }
	})	
    }
    
}


// const initialized	= await request("init", "development");

// console.log( initialized );

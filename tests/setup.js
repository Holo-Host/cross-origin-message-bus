const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

// Start simple HTTP servers

const http				= require('http');
const url				= require('url');
const fs				= require('fs');

const HAPP_PORT				= 4531;
const CHAP_PORT				= 4532;

function create_server ( base_dir, port ) {
    const server			= http.createServer(function (request, response) {
	try {
	    const req_url		= url.parse( request.url );

	    const fs_path		= base_dir + path.normalize( req_url.pathname );

	    log.normal("Looking for file @ %s", fs_path );
	    var file_stream		= fs.createReadStream( fs_path );
	    file_stream.pipe( response );
	    file_stream.on('open', function () {
		response.writeHead( 200 );
	    });
	    file_stream.on('error',function(e) {
		// assume the file doesn't exist
		response.writeHead( 404 );
		response.end();
	    });
	} catch( e ) {
	    log.fatal("Failed to process request: %s", e );
	    console.error( e );
	    
	    response.writeHead( 500 );
	    response.end();
	}
    });

    server.listen( port );
    
    return server;
}

function async_wrapper ( fn ) {
    return new Promise(function (fulfill, reject) {
	try {
	    fn( fulfill, reject );
	} catch ( e ) {
	    reject( e );
	}
    });
}

function main () {
    const happ_server			= create_server( "./html/happ",		HAPP_PORT );
    const chap_server			= create_server( "./html/chaperone",	CHAP_PORT );

    return {
	"servers": {
	    "happ":		happ_server,
	    "chaperone":	chap_server,
	},
	"ports": {
	    "happ":		HAPP_PORT,
	    "chaperone":	CHAP_PORT,
	},
	"close": async function () {
	    return await Promise.all([
		async_wrapper( f => happ_server.close( f )),
		async_wrapper( f => chap_server.close( f )),
	    ]);
	}
    };
}

module.exports				= main;

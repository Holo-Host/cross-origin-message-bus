
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
	const to_id			= setTimeout(() => {
	    r( new TimeoutError("Waited for " + (timeout/1000) + " seconds", timeout ) );
	}, timeout);

	try {
		const result		= await fn();
		console.log('----------- fn : ', fn);
		console.log('RESULT : ', result);
	    f( result );
	} catch ( err ) {
		console.log('ERROR ; ', err);
	    r( err );
	} finally {
		console.log('clearing TIMEOUT....');

	    clearTimeout( to_id );
	}
    });
}

export default async_with_timeout;
export {
    TimeoutError,
}

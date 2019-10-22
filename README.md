
# Cross-origin Message Bus (COMB)

COMB is a library that facilitates the calls between the parent window (hApp UI) and the iframe
(Chaperone).

Used by `Holo Chaperone` and `Holo Hosting Web SDK`.

## Architecture

We use `Postmate` to set up a message tunnel between the parent and child frames.

### API

```javascript
const child = await comb.connect( url );

await child.set("mode", mode );

let response = await child.run("signIn");
```

```javascript
const parent = comb.listen({
    "signIn": async function ( ...args ) {
	if ( this.mode === DEVELOP )
            ...
	else
            ...
    	return response;
    },
});
```

## Features

- Parent/Child communication line
- Promise wrappers
- Round trip method request
- Restrict domains

## Testing

Setup

- HTTP Server for parent window (hApp UI)
- HTTP Server for child window (Holo Chaperon)
- Call methods from parent, mock responses from external systems (Resolver, Envoy)

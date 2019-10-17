
# Cross-origin Message Bus (COMB)

COMB is a library that facilitates the calls between the parent window (hApp UI) and the iframe
(Chaperone).

Used by `Holo Chaperone` and `Holo Hosting Web SDK`.

## Features

- Parent/Child communication line
- Promise wrappers
- Restrict domains

## Testing

Setup

- HTTP Server for parent window (hApp UI)
- HTTP Server for child window (Holo Chaperon)
- Call methods from parent, mock responses from external systems (Resolver, Envoy)

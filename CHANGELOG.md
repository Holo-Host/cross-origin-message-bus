# Changelog
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2022-06-01

### Changed
- Format code with prettier-standard
- Added and updated types to be more specific
- msgpack encodes/decodes data passing through postmate, to avoid json stringify issues with complex data types, eg Uint8Arrays
- Propogates errors thrown by listener methods. (eg if `zomeCall` throws in chaperone, now `zomeCall` in web-sdk will throw that error)
- Updates typescript build config to work with msgpack
- Replaces npm with yarn

## [0.2.0] - 2021-02-04
### Added
- Handle signals. `ParentAPI` now has a `.sendSignal` method which calls a `signalCb` passed in through `COMB.connect`

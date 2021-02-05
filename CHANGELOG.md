# Changelog
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2021-02-04
### Added
- Handle signals. `ParentAPI` now has a `.sendSignal` method which calls a `signalCb` passed in through `COMB.connect`

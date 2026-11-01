# KindleForge package

Files for the [KindleForge Repository](https://github.com/KindleTweaks/Repository):

- `BrewReader/install.sh` and `BrewReader/uninstall.sh` go in the Repository as `BrewReader/`.
- `registry-entry.json` is appended to the Repository's `registry.json` array.

`install.sh` downloads `brewreader.zip` from this repo's latest GitHub release, so the repo must be public and have a release (push a `v*` tag; `.github/workflows/release.yml` builds it).

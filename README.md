# Brew Reader

Unofficial Kindle app for reading the free daily [Morning Brew](https://www.morningbrew.com/issues/latest) newsletter in a clean, e-ink friendly layout.

**Not affiliated with or endorsed by Morning Brew.** The app loads the public issue page directly from morningbrew.com on your Kindle; nothing is hosted or redistributed by this project.

Built as an Illusion (mesquite) app in the same format as the [KindleForge](https://github.com/KindleTweaks/KindleForge) packages. The app config and launcher are adapted from [KWordle](https://github.com/crizmo/kwordle) by Kurizu.

## Requirements

- Jailbroken Kindle with the latest Universal Hotfix (see KindleForge's requirements)
- Wi-Fi

## Install

1. Run `./build.sh` (or grab `brewreader.zip` from releases).
2. Unzip it and copy both `brewreader/` and `brewreader.sh` into the Kindle's `documents/` folder.
3. Open **Brew Reader** from the library.

## Reading

- Tap the right two-thirds of the screen for the next page, the left third to go back (swipes also work where the Kindle sends touch events).
- Pages break between lines, like a Kindle book, so nothing is repeated or cut.
- The **⋮** menu has **Reload**, **Larger Text** and **Smaller Text**. Text size is remembered; images keep their size.

## How it works

`brewreader/main.js` requests `https://www.morningbrew.com/issues/latest`, reads the issue from the page's `__NEXT_DATA__` JSON (`props.pageProps.issueData`), strips the email styling, social icons and anything executable, and renders it as a single column. If that request fails, it falls back to `latest.html`, which `brewreader.sh` downloads with `curl` in the background at launch.

Images are requested from Morning Brew's image CDNs at a few fixed widths in grayscale, which caches well across devices; if a resized image fails, the original loads instead.

If Morning Brew changes their page, the app says so instead of blaming Wi-Fi, and the daily **Check Morning Brew page** GitHub Action fails so the maintainer hears about it first.

## Icon

The library cover is embedded in `brewreader.sh` as a `# Icon:` data URI. Edit `assets/cover.html`, then run `tools/make-cover.sh` (needs Google Chrome) to re-render it.

## Test

```sh
node test/extract.test.js            # against the live page
node test/extract.test.js page.html  # against a saved page
```

## Pushing to a Kindle from macOS

Newer Kindles connect over MTP, which macOS doesn't mount. They also drop off USB after each MTP session, so `tools/mtp-push` does the whole copy in one session:

```sh
brew install libmtp
cc -o tools/mtp-push tools/mtp-push.c -I"$(brew --prefix)/include" -L"$(brew --prefix)/lib" -lmtp
./tools/mtp-push .   # then plug in and unlock the Kindle
```

## License

MIT. See [LICENSE](LICENSE), which also carries KWordle's notice for the adapted files.

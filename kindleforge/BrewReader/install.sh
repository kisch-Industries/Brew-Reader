#!/bin/sh

set -e

TMPDIR=/mnt/us/KFPM-Temporary
mkdir -p "$TMPDIR"

# Download + Extract
curl -fSL --progress-bar -o "$TMPDIR/brewreader.zip" https://github.com/kisch-Industries/Morning-Brew-Kindle-Forge/releases/latest/download/brewreader.zip
unzip -oq "$TMPDIR/brewreader.zip" -d "$TMPDIR"

# Copy Contents
mkdir -p /mnt/us/documents/brewreader
cp -r "$TMPDIR/brewreader"/* /mnt/us/documents/brewreader/
cp "$TMPDIR/brewreader.sh" /mnt/us/documents/
chmod +x /mnt/us/documents/brewreader.sh

# Cleanup
rm -rf "$TMPDIR"

exit 0

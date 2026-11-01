#!/bin/sh
# Builds dist/brewreader.zip: unzip into the Kindle's documents/ folder.
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
zip -qr dist/brewreader.zip brewreader brewreader.sh -x '*.DS_Store' 'brewreader/latest.html'
echo "Built dist/brewreader.zip"

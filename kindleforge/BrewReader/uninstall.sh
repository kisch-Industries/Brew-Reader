#!/bin/sh

set -e

APP_ID="com.alexkisch.brewreader"

rm -rf /mnt/us/documents/brewreader/
rm -rf /var/local/mesquite/brewreader/
rm -f /mnt/us/documents/brewreader.sh

# Unregister the app added by brewreader.sh
sqlite3 /var/local/appreg.db <<SQL
DELETE FROM properties WHERE handlerId='$APP_ID';
DELETE FROM handlerIds WHERE handlerId='$APP_ID';
SQL

exit 0

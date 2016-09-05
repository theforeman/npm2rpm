#!/bin/bash

if [ $# -ne 2 ]; then
  echo "usage: $0 PACKAGE OUTPUT.TGZ"
  exit 1
fi
package=$1
output=$2
wd=$(mktemp -d)
trap "rm -r '$wd'" EXIT INT TERM

create_cache() {
  node_modules/npm/bin/npm-cli.js install --cache $wd/cache $package --production --verbose
}

mkdir $wd/cache-combined $wd/cache $wd/install
cd $wd/install
npm install npm@1.3.x
create_cache
# save el7 (which uses 1.3.6 npm) results before running it again
mv $wd/cache/* $wd/cache-combined
rm -r node_modules $wd/cache
# f24 will save its cache in registry.npmjs.org
npm install npm@2.x
create_cache
# Restore cache from el7
mv $wd/cache/registry.npmjs.org $wd/cache-combined/
cd - 2>/dev/null
(cd $wd/cache-combined && find . -name .cache.json | xargs tar zcf -) > $output

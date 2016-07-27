#!/bin/bash

if [ $# -ne 2 ]; then
  echo "usage: $0 PACKAGE OUTPUT.TGZ"
  exit 1
fi
package=$1
output=$2

wd=$(mktemp -d)
trap "rm -rf '$wd'" EXIT INT TERM

mkdir $wd/cache $wd/install
cd $wd/install
npm install --cache $wd/cache $package
cd - 2>/dev/null

(cd $wd/cache/registry.npmjs.org && find . -name .cache.json | xargs tar zcf -) > $output

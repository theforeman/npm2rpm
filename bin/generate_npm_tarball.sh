#!/bin/bash

if [ $# -ne 2 ]; then
  echo "usage: $0 PACKAGE[@VERSION] OUTPUT.TGZ"
  exit 1
fi
package=$1
output=$(pwd)/$2
wd=$(mktemp -d)
trap "rm -r '$wd'" EXIT INT TERM

create_cache() {
  node_modules/npm/bin/npm-cli.js install --cache $wd/cache $package --no-shrinkwrap --no-optional --production --verbose
}

mkdir $wd/cache $wd/install
cd $wd/install
npm install npm@3.x
create_cache
cd $wd/cache
tar --create --gzip --file $output .

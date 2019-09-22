#!/bin/bash

if [ $# -lt 2 ]; then
  echo "usage: $0 PACKAGE[@VERSION] OUTPUT.TGZ [USE NODEJS 6]"
  exit 1
fi
package=$1
output=$(pwd)/$2
usenodejs6=${3:-false}
wd=$(mktemp -d)
trap "rm -rf '$wd'" EXIT INT TERM

create_cache() {
  if [[ $usenodejs6 == true ]];then
    node_modules/npm/bin/npm-cli.js install --cache $wd/cache $package --no-shrinkwrap --no-optional --production --verbose
  else
    npm install --cache $wd/cache $package --no-shrinkwrap --no-optional --production --verbose
  fi
}

mkdir $wd/cache $wd/install
cd $wd/install
if [[ $usenodejs6 == true ]];then
  npm install npm@3.x
fi
create_cache
cd $wd/cache
tar --create --gzip --file $output .

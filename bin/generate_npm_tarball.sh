#!/bin/bash

if [ $# -lt 2 ]; then
  echo "usage: $0 PACKAGE[@VERSION] OUTPUT.TGZ [USE NODEJS 6] [SPECFILE_FOR_PURGE]"
  exit 1
fi
package=$1
output=$(pwd)/$2
usenodejs6=${3:-false}
specfile="$4"
wd=$(mktemp -d)
trap "rm -rf '$wd'" EXIT INT TERM

create_cache() {
  if [[ $usenodejs6 == true ]];then
    node_modules/npm/bin/npm-cli.js install --cache $wd/cache $package --no-shrinkwrap --no-optional --production --verbose
    (cd $wd/cache && find -type f | sort) > $wd/to-compress
  else
    if [[ -n $specfile ]] ; then
      mkdir $wd/spec
      spectool --get-files --directory $wd/spec "$specfile"

      for filename in $wd/spec/*.tgz ; do
        if [[ "$filename" != "*-registry.npmjs.org.tgz" ]] ; then
          npm cache add --cache $wd/cache $filename
        fi
      done
    fi

    (cd $wd/cache && find -type f | sort) > $wd/cache-primed

    npm install --cache $wd/cache $package --no-shrinkwrap --no-optional --production --verbose

    (cd $wd/cache && find -type f | sort) > $wd/cache-full

    grep --invert-match --file $wd/cache-primed $wd/cache-full > $wd/to-compress
  fi
}

if [[ -n $specfile ]] ; then
  specfile=$(realpath "$specfile")
fi

mkdir $wd/cache $wd/install
cd $wd/install
if [[ $usenodejs6 == true ]];then
  npm install npm@3.x
fi

create_cache

cd $wd/cache
tar --create --auto-compress --file $output --files-from $wd/to-compress

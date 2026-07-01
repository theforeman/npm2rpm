#!/bin/bash

set -x

if [ $# -lt 2 ]; then
  echo "usage: $0 PACKAGE[@VERSION] OUTPUT.TGZ [SPECFILE_FOR_PURGE]"
  exit 1
fi
package=$1
output=$(pwd)/$2
specfile="$3"
legacypeerdeps=${4:-false}
cachedir=${5:-}  # Optional: directory with cached dependency tarballs
wd=$(mktemp -d)
trap "rm -rf '$wd'" EXIT INT TERM

create_cache() {
  if [[ -n $specfile ]] ; then
    mkdir $wd/spec

    # Check for cached tarballs from binary analysis (passed as parameter)
    if [[ -n "$cachedir" && -d "$cachedir" ]] ; then
      # Copy cached tarballs instead of downloading
      echo "Using cached dependency tarballs from $cachedir"
      find "$cachedir" -maxdepth 1 -name '*.tgz' -type f -exec cp -v -t $wd/spec/ {} +
    fi

    # Download any missing tarballs with spectool
    spectool --get-files --directory $wd/spec "$specfile"

    for filename in $wd/spec/*.tgz ; do
      if [[ "$filename" != "*-registry.npmjs.org.tgz" ]] ; then
        npm cache add --cache $wd/cache $filename
      fi
    done
  fi

  (cd $wd/cache && find -type f | sort) > $wd/cache-primed

  if [[ $legacypeerdeps == true ]];then
    npm install --legacy-peer-deps --cache $wd/cache $package --no-shrinkwrap --no-optional --production --ignore-scripts --verbose
  else
    npm install --cache $wd/cache $package --no-shrinkwrap --no-optional --production --ignore-scripts --verbose
  fi

  (cd $wd/cache && find -type f | sort) > $wd/cache-full

  grep --invert-match --file $wd/cache-primed $wd/cache-full > $wd/to-compress
}

if [[ -n $specfile ]] ; then
  specfile=$(realpath "$specfile")
fi

mkdir $wd/cache $wd/install
cd $wd/install

create_cache

cd $wd/cache
tar --create --auto-compress --file $output --files-from $wd/to-compress

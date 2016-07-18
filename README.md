npm2rpm
=======

:construction: This project is not finished yet. Use at your own peril.

npm2rpm - convert npm modules to RPM packages

  Usage: npm2rpm [options]

  Options:

    -h, --help                 output usage information
    -n, --name <name>          NodeJS module name
    -v, --version [version]    module version in X.Y.Z format
    -r, --release [release]    RPM's release
    -t, --template [template]  RPM .spec template to use (by default default.n2r)

Example: ./bin/npm2rpm.js -n webpack -v 1.13.1 -> prints out the rpm spec.

TODOs:
  - Retrieve files for %files doc section
  - Retrieve files for %install section
  - Download sources
  - Install from sources in %build or %prep


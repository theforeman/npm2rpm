npm2rpm
=======

[![Known Vulnerabilities](https://snyk.io/test/github/dlobatog/npm2rpm/badge.svg)](https://snyk.io/test/github/dlobatog/npm2rpm)
[![Code Climate](https://codeclimate.com/github/dLobatog/npm2rpm/badges/gpa.svg)](https://codeclimate.com/github/dLobatog/npm2rpm)
[![Build Status](https://travis-ci.org/dLobatog/npm2rpm.svg?branch=master)](https://travis-ci.org/dLobatog/npm2rpm)

npm2rpm - convert npm modules to RPM packages

```console
Usage: npm2rpm [options]

Options:

  -n, --name <name>          NodeJS module name
  -v, --version <version>    module version in X.Y.Z format
  -s, --strategy [strategy]  Strategy to build the npm packages
  -r, --release [release]    RPM's release (default: 1)
  -t, --template [template]  RPM .spec template to use
  -o, --output [directory]   Directory to output files to
  -h, --help                 output usage information
```

To create `npm2rpm/nodejs-webpack.spec`:

```console
./bin/npm2rpm.js -n webpack -v 4.20.2
```

To download the sources you can use [spectool](https://fedoraproject.org/wiki/Rpmdevtools):

```console
spectool --get-files nodejs-webpack.spec
```

## How?

To package npm dependencies in RPM, you have 3 strategies:

#### Packaging 'single' npm modules into rpms. (-s --strategy single)
This is the way most Linux distributions prefer to do it. See the [Fedora guidelines](https://fedoraproject.org/wiki/Packaging:Node.js) about packaging nodejs libraries.
The content of this package will contain just the content of the module, without bundled dependencies. It'll have `Requires` and `Provides` equal to the same you see in `package.json`.

It's the way traditional packaging has always worked. However this model conflicts with the way npm modules are used. `npm install` stores the whole dependency tree for all of your application dependencies. This is a problem, as your application may depend on 'async >= 1.0.0' but your dependencies may depend on 'async ~ 0.2.0'.

At this point you may have noticed you cannot build 2 RPMs for the same dependency and expect both versions to be installed at the same time. This makes it impossible for two applications with different dependency requirements to work, so this strategy of having one module per RPM spec is very impractical.

In practice, a medium-sized web application can easily have hundreds of dependencies (counting different versions of the same dependency) due to how `npm install` works. Disregard this stratey if you want to package the dependencies for your application or you'll be in trouble :smile:

#### Packaging npm modules with bundled dependencies (-s --stategy bundle)
I took this idea from [njs2rpm](https://github.com/sfreire/njs2rpm). If you still want to package your applications as rpms, and not face dependency conflicts, you may want to go with this.

The main idea is to include the node_modules directory (dependency tree) in every RPM package.

    +--------+----------------------+----------------------+-----------------------------+
    |  Type  |       RPM name       |      Provides        |          Requires           |
    +--------+----------------------+----------------------+-----------------------------+
    | Single | nodejs-<name>        | npm(<name>)          | npm(<dep1>)                 |
    |        |                      |                      | ...                         |
    |        |                      |                      | npm(<depM>)                 |
    | Bundle | nodejs-bundle-<name> | npm(<name>)          | (no deps as Requires)       |
    |        |                      |                      |                             |
    |        |                      | bundled(npm(<dep1>)) |                             |
    |        |                      | ...                  |                             |
    |        |                      | bundled(npm(<depN>)) |                             |
    +--------+----------------------+----------------------+-----------------------------+

This is OK(ish) as you solve the problem of conflicting dependencies by bundling dependencies. Furthermore other applications can depende on your system library by having a `Requires: npm(name)` However it still seems wrong to put these libraries in your `%{nodejs_sitelib}` - it's like your installing stuff on the user system but they don't really know about these bundled deps or any security they may have. So I understand why [Fedora guidelines](https://fedoraproject.org/wiki/Bundled_Libraries?rd=Packaging:Bundled_Libraries) discourage this kind of bundling for system packages.

In order to include these bundled dependencies, `npm2rpm` downloads all dependencies and puts them in the SOURCES folder, and it adds the Provides/Sources for them. It uses npm to install the package, and since it assumes you'll build the package in an offline machine (common security measure), `npm2rpm` generates a tarball with an npm cache, so that it's able to install it offline. Notice the npm cache has to be generated using the same major version of npm as the one used in the machine where you build the package. e.g: a cache generated with npm 1.3.6 will not work with 2.3.5.

You can circumvent this problem by generating the cache tar manually with all npm versions you want, then put it all in the same tarball. To generate the cache tarball on other npm versions, you can use the script `generate_npm_tarball.sh`. By default npm2rpm will generate a cache tarball with your default npm version, so you should only generate it manually if you want cache tarballs for multiple npm versions

#### Putting your node_modules in a separate package
If none of these two options were good for you, you can put your `node_modules` directory in a tar. Then unpack the module in a location known by your main application, and copy it from there. No other application in your system needs to even know your npm dependencies exist. Check out [an example here](https://github.com/dLobatog/foreman-packaging/blob/f71bc800c2f4bef5869edae5f6aa87e2a94f735d/foreman-node_modules/foreman-node_modules.spec).

## PeerDependencies

On npm versions less than 3.0.0, npm will try to install peerDependencies. Currently `npm2rpm` does not generate the spec with support for peerDependencies, however, it's easy to do it yourself (for now!).

Start by adding 'BuildRequires' for all peerDependencies (you need to generate these packages too). For example, for babel-loader:

```
BuildRequires: npm(webpack)
BuildRequires: npm(babel-core)
```

On your %build section, make symbolic links for these libraries before running `npm install`:

```
ln -s %{nodejs_sitelib}/webpack node_modules/webpack
ln -s %{nodejs_sitelib}/babel-core node_modules/babel-core
npm install babel-loader@6.2.4 --cache-min Infinity --cache .
```

That's all you need to include peerDependencies in your packages

## License

GPLv3 - see [LICENSE](LICENSE)

Thanks to [njs2rpm](https://github.com/sfreire/njs2rpm)(abandoned) and [foreman-packaging](https://github.com/theforeman/foreman-packaging/) that provided motivation to make this project.

##### TODOs:
  - Support peerDependencies with bundled packages

npm2rpm
=======

npm2rpm - convert npm modules to RPM packages

  Usage: npm2rpm [options]

  Options:

    -h, --help                 output usage information
    -n, --name <name>          NodeJS module name
    -s, --strategy [strategy]  Strategy to build the npm packages
    -v, --version [version]    module version in X.Y.Z format
    -r, --release [release]    RPM's release
    -t, --template [template]  RPM .spec template to use (by default default.n2r)

Example: ./bin/npm2rpm.js -n webpack -v 1.13.1 -> creates the spec and downloads sources in npm2rpm/

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

    +--------+----------------------+---------------------+-----------------------------+
    |  Type  |       RPM name       |      Provides       |          Requires           |
    +--------+----------------------+---------------------+-----------------------------+
    | Single | nodejs-<name>        | npm(<name>)         | npm(<dep1>)                 |
    |        |                      |                     | ...                         |
    |        |                      |                     | npm(<depM>)                 |
    | Bundle | nodejs-bundle-<name> | npm(<name>)         | (no deps as Requires)       |
    |        |                      |                     |                             |
    |        |                      | bundled-npm(<dep1>) |                             |
    |        |                      | ...                 |                             |
    |        |                      | bundled-npm(<depN>) |                             |
    +--------+----------------------+---------------------+-----------------------------+

This is OK(ish) as you solve the problem of conflicting dependencies by bundling dependencies. Furthermore other applications can depende on your system library by having a `Requires: npm(name)` However it still seems wrong to put these libraries in your `%{nodejs_sitelib}` - it's like your installing stuff on the user system but they don't really know about these bundled deps or any security they may have. So I understand why [Fedora guidelines](https://fedoraproject.org/wiki/Bundled_Libraries?rd=Packaging:Bundled_Libraries) discourage this kind of bundling for system packages.

It's a fine solution for your application, but keep in mind your `Source0` in this case will not be the npm registry. It'll be a tar you've modified to include the `node_modules`.

PS: Alternatively, you can have multiple sources `Source0`, `Source1`, and so forth for all dependencies. However this is highly impractical as you will have to replicate the `node_modules` tree dependencies structure in the RPM spec itself.

#### Putting your node_modules in a separate package
If none of these two options were good for you, you can put your `node_modules` directory in a tar. Then unpack the module in a location known by your main application, and copy it from there. No other application in your system needs to even know your npm dependencies exist. Check out [an example here](https://github.com/dLobatog/foreman-packaging/blob/f71bc800c2f4bef5869edae5f6aa87e2a94f735d/foreman-node_modules/foreman-node_modules.spec).

## License

GPLv3 - see [LICENSE](LICENSE)

Thanks to [njs2rpm](https://github.com/sfreire/njs2rpm)(abandoned) and [foreman-packaging](https://github.com/theforeman/foreman-packaging/) that provided motivation to make this project.

##### TODOs:
  - Actually build RPM (currently it only downloads sources & writes spec)
  - Add option to pass source file manually (useful for bundled strategy)

# translation-compare

Installation:

```
npm install -g sigues/translation-compare
```

Usage:

```
$ translation-compare --help

Usage: translation-compare [options]

Options:
  -V, --version                 output the version number
  -p, --path [optional]         path to look for yaml files
  -ref, --reference [optional]  locale bcp47 identifier in which the reference files are written in. default is en-us.
  -t, --targets [optional]      a comma separated list of bcp47 target locales to create files from reference. default is fr-fr.
  -g, --glob [optional]         glob used to look for yaml files. default is **/en-us.{yml,yaml}.
  -h, --help                    output usage information
```
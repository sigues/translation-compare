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
  -p, --path <path>             path to look for yaml files
  -r, --reference <identifier>  locale bcp47 identifier in which the reference files are written in, default is "en-us"
  -t, --targets <targets>       a comma separated list of bcp47 target locales to create files from reference, default is "fr-fr"
  -g, --glob <glob>             glob used to look for yaml files, default is "**/en-us.{yml,yaml}"
  -k, --key-file <path>         account key file used to identify with google, default is "key.json"
  -h, --help                    output usage information
```
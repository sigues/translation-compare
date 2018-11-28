#!/usr/bin/env node

'use strict';

const path = require('path');
const glob = require('glob');
const fs = require('fs');
const program = require('commander');
const yaml = require('js-yaml');
const bcp47 = require('bcp-47');
const Translate = require('@google-cloud/translate').Translate;
const format = require('string-format');

class TranslationToken {
  constructor(source) {
    let placeholders = [];
    let nesting = 0;
    let currentPlaceholder = '';
    let translationSafeWord = '';

    for (let i = 0; i < source.length; i++) {
      if (nesting === 0) {
        translationSafeWord += source.charAt(i);
      }

      if (source.charAt(i) === '{') {
        nesting++;
      }

      if (nesting > 0) {
        currentPlaceholder += source.charAt(i);
      }

      if (source.charAt(i) === '}') {
        nesting--;
        if (nesting === 0) {
          placeholders.push(currentPlaceholder);
          currentPlaceholder = '';
          translationSafeWord += source.charAt(i);
        }
      }
      
    }

    this.source = source;
    this.placeholders = placeholders;
    this.translationSafeWord = translationSafeWord;
  }

  /**
   * removes placeholders from message
   * e.g "How are you, {name}?" becomes "How are you, {}?"
   * Google translate will leave the {} untouched, so that we can fill it in later.
   * @returns {string}
   */
  getTranslationSafe() {
    return this.translationSafeWord;
  }

  /**
   * takes a translated text with {} placeholders and fills it with the orignal placeholder values values
   * e.g "Comment vas-tu, {}?" becomes "Comment vas-tu, {name}?"
   * @param {string} translation the translated text
   */
  rebuildPlaceholders(translation) {
    return format(translation, ...this.placeholders);
  }
}

const DEFAULT_REF_LOCALE = 'en-us';
const DEFAULT_GLOB = `**/${DEFAULT_REF_LOCALE}.{yml,yaml}`;
const DEFAULT_TARGET_LOCALES = ['fr-fr'];
const DEFAULT_KEY_FILE = 'key.json';

program
  .version(require('../package.json').version)
  .option('-p, --path <path>', 'path to look for yaml files')
  .option('-r, --reference <identifier>', `locale bcp47 identifier in which the reference files are written in, default is "${DEFAULT_REF_LOCALE}"`)
  .option('-t, --targets <targets>', `a comma separated list of bcp47 target locales to create files from reference, default is "${DEFAULT_TARGET_LOCALES}"`)
  .option('-g, --glob <glob>', `glob used to look for yaml files, default is "${DEFAULT_GLOB}"`)
  .option('-k, --key-file <path>', `account key file used to identify with google, default is "${DEFAULT_KEY_FILE}"`)
  .parse(process.argv);

const rootPath = path.resolve(process.cwd(), program.path || '.');
const globValue = program.glob || DEFAULT_GLOB;
const refLocale = program.reference || DEFAULT_REF_LOCALE;
const targetLocales = program.targets ? program.targets.split(',').map((s) => s.trim()) : DEFAULT_TARGET_LOCALES;

// ember-intl (which uses Intl.js) uses bcp47 locale codes in
// its locale file yaml names. the bcp47 package allows us to find the
// language code of a bcp47 identifier. That language code will then be sent to google translate.
const refLanguage = bcp47.parse(refLocale).language;
const keyFile = program.keyFile || DEFAULT_KEY_FILE;

// Instantiates a client
const translate = new Translate({
  keyFilename: keyFile
});

run();

async function run() {

  console.log(`Looking for Yaml files on directory ${rootPath} with glob ${globValue}.`);

  let yamlFiles = glob.sync(globValue, { 
    cwd: rootPath,
  });

  if (yamlFiles.length === 0) {
    console.log('No yaml files were found.');
    process.exit(0);
  }

  console.log(`Found ${yamlFiles.length} reference files.`);

  // iterate the reference language files
  for (let refPath of yamlFiles) {

    let dir = path.dirname(refPath);
    let ext = path.extname(refPath); // this includes the dot (.)

    let fullPath = path.resolve(rootPath, refPath);
    let refDoc = yaml.safeLoad(fs.readFileSync(fullPath, 'utf8'));

    for (let tLocale of targetLocales) {

      // compute the path of the current target language
      let tPath = path.resolve(rootPath, dir, `${tLocale}${ext}`);

      // we default the doc structure to an empty object
      let doc = {};
      // and overwrite it if the file exists
      if (fs.existsSync(tPath)) {
        doc = yaml.safeLoad(fs.readFileSync(tPath, 'utf8'));
      }

      // delete keys that aren't on the reference doc
      deleteKeys(refDoc, doc);

      let tLanguage = bcp47.parse(tLocale).language;

      // add keys that are on the reference and aren't on this file
      await addKeys(refLanguage, refDoc, tLanguage, doc);

      fs.writeFileSync(tPath, yaml.safeDump(doc, {
        lineWidth: -1 // this avoids line chomping
      }));

      console.log(`Wrote ${tPath}`);
    }

  }
}

function deleteKeys(refDoc, doc) {
  for (let prop in doc) {
    // this avoids iterating any prototype properties which we are not interested in
    if (doc.hasOwnProperty(prop)) {

      if (refDoc.hasOwnProperty(prop)) {
        // if the reference has the same property and is itself an object, we do a recursive call
        if (typeof refDoc[prop] === 'object' && typeof doc[prop] === 'object') {
          deleteKeys(refDoc[prop], doc[prop]);
        } else if (typeof refDoc[prop] !== typeof doc[prop]) {
          // if the reference and current doc types are different, then there is some kind of
          // mismatch. delete the key on the current doc. It will be later be added correctly.
          delete doc[prop];
        }
      } else {
        // reference doc does not have this property. delete it from current doc.
        delete doc[prop];
      }

    }
  }
}

async function addKeys(refLanguage, refDoc, toLanguage, doc) {
  for (let prop in refDoc) {
    // this avoids iterating any prototype properties which we are not interested in
    if (refDoc.hasOwnProperty(prop)) {

      // if this reference prop is an object
      if (typeof refDoc[prop] === 'object') {

        // initialize empty object if target doesn't have it or it is empty
        if (!doc.hasOwnProperty(prop) || !doc[prop]) {
          doc[prop] = {};
        }

        // recursive call
        await addKeys(refLanguage, refDoc[prop], toLanguage, doc[prop]);
      } else {
        // if reference prop is a string and current doc doesn't have it, add it to target
        if (!doc.hasOwnProperty(prop)) {
          try {
            let t = new TranslationToken(refDoc[prop]);
            let results = await translate.translate(t.getTranslationSafe(), {
              from: refLanguage,
              to: toLanguage
            });
            doc[prop] = t.rebuildPlaceholders(results[0]);
          } catch(e) {
            console.error(`Error translating "${refDoc[prop]}". Probably a bad server response. Please try again later.\n`, e);
          }
          
        }
      }

    }
  }
}
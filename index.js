#!/usr/bin/env node

'use strict';

const program = require('commander');
var yaml = require('js-yaml');
var yamlGenerator = require('yamljs');
const {Translate} = require('@google-cloud/translate');
const projectId = 'YOUR_PROJECT_ID';
const fs = require('fs')
const { join } = require('path')
var nestedProperty = require("nested-property");
var docFr;

const translate = new Translate({
  projectId: projectId,
});

const isDirectory = source => fs.lstatSync(source).isDirectory()
const getDirectories = source =>
  fs.readdirSync(source).map(name => join(source, name)).filter(isDirectory)

let compareFunction = (directory,options) => {
  if(program.path){
    iterateDirectories(program.path);
  }
}

function iterateDirectories(path) {
  var directories = getDirectories(path);
  if(isDirectory(path) && directories.length > 0){
    directories.forEach(function(element){
      iterateDirectories(element)
    });
  } else {
    console.log(path);
    const fileEn = path+'/en-us.yaml';
    const fileFr = path+'/fr-fr.yaml';
    if(fs.existsSync(fileEn)){
      var docEn = yaml.safeLoad(fs.readFileSync(fileEn, 'utf8'));;
      docFr = {};
      if(fs.existsSync(fileFr)){
        docFr = yaml.safeLoad(fs.readFileSync(fileFr, 'utf8'));
      }
      iterate(docEn,'');
      fs.writeFile(fileFr, yamlGenerator.stringify(docFr,4), function(err) {
          if(err) {
              return console.log(err);
          }
          console.log("The file was saved!");
      });
      return;
    }
  }
}

function iterate(obj, stack) {
  let fullPath = (stack) ? stack + '.' : '';
  let realPath;
  let translatedValue;
  let translated;
  for (var property in obj) {
    if (obj.hasOwnProperty(property)) {
      if (typeof obj[property] == "object") {
        iterate(obj[property], stack + '.' + property);
      } else {
        console.log('EN:')
        console.log(fullPath + property + "   " + obj[property]);
        console.log('FR:')
        realPath = fullPath + property;
        realPath = realPath.substring(1);
        translatedValue = nestedProperty.get(docFr,realPath);
        console.log(realPath + "   " + translatedValue);
        if(typeof translatedValue == "undefined" && typeof obj[property] == "string"){
          nestedProperty.set(docFr,realPath,obj[property])
          translate
            .translate(obj[property], 'fr')
            .then(results => {
              const translation = results[0];
              nestedProperty.set(docFr,realPath,translation)
            })
            .catch(err => {
              console.error('ERROR:', err);
            });
        }
      }
    }
  }
}

program
.version('0.0.1')
.option('-p, --path [optional]','path to compare description')
.action(compareFunction)
.parse(process.argv); // end with parse to parse through the input

#!/usr/bin/env node

'use strict';

const program = require('commander');
var yaml = require('js-yaml');
var yamlGenerator = require('yamljs');

const fs = require('fs')
const { join } = require('path')
var nestedProperty = require("nested-property");
var docFr;
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
      console.log('===========');
      return;
    }
  }
}

function iterate(obj, stack) {
  let fullPath = (stack) ? stack + '.' : '';
  let realPath;
  let translatedValue;
  for (var property in obj) {
    if (obj.hasOwnProperty(property)) {
      if (typeof obj[property] == "object") {
        iterate(obj[property], stack + '.' + property);
      } else {
        console.log('EN:')
        console.log(fullPath + property + "   " + obj[property]);
        console.log('FR:')
        console.log(docFr);
        translatedValue = deepFind(docFr, fullPath + property);
        if(typeof translatedValue == "undefined"){
          realPath = fullPath + property;
          realPath = realPath.substring(1);
          nestedProperty.set(docFr,realPath,obj[property])
        }
      }
    }
  }
}

function deepFind(obj, path) {
  path = path.substring(1)
  var paths = path.split('.')
  , current = obj
  , i;

  for (i = 0; i < paths.length; ++i) {
    console.log(current);
    if (current[paths[i]] == undefined) {
      return undefined;
    } else {
      current = current[paths[i]];
    }
  }
  return current;
}

program
.version('0.0.1')
.option('-p, --path [optional]','path to compare description')
.action(compareFunction)
.parse(process.argv); // end with parse to parse through the input

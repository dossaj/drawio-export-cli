#!/usr/bin/env node

'use strict'

var fs = require('fs');
var path = require('path');

const program = require('commander');
const puppeteer = require('puppeteer');

var input = null;
var output = null;
var args = null;

program
  .name('drawio-export-cli')
  .version(require('./package.json').version)
  .option('-d, --debug', 'Enable debugging dump')
  .option('-i, --ignore', 'Ignore certificate errors')
  .arguments('<source> <destination>')
  .action(function (source, destination, opts) {
    input = source;
    output = destination;
    args = opts;
  })
  .parse(process.argv);

(async () => {
    var options = {
        args: ['--no-sandbox', '--disable-web-security'],
        dumpio: args.debug || false
    }

    if(args.ignore){
        console.warn('Ignoring certificate errors');
        options.args.push('--ignore-certificate-errors');
    }
    
    const browser = await puppeteer.launch(options);

    try {
        var file = await fs.readFileSync(input, 'utf-8');

        const page = await browser.newPage();
        await page.goto('file://' + __dirname + '/views/export.html', {
            waitUntil: 'load'
        });

        await page.evaluate(function (xml) {
            return exportSvg({ xml: xml }) 
        }, file);

        await page.waitForSelector('#output');
        var data = await page
            .mainFrame()
            .$eval('#output', div => {
                var result = [];
                var diagrams = Array.from(div.children);
                diagrams.forEach(diagram => {
                    result.push({
                        name: diagram.getAttribute("id").toLowerCase(),
                        data: diagram.getAttribute("data")
                    });
                });
                return result;
            });
        
        
        var filename = path.parse(output);
        var exists = await fs.existsSync(filename.dir);
        if(!exists){
            await fs.mkdirSync(filename.dir);
        }

        data.forEach(async item => {
            var out = path.join(filename.dir, filename.name + "." + item.name + filename.ext);
            await fs.writeFileSync(out, item.data);    
        });
        
    } catch (error) {
        console.log(error);
        process.exit(1);
    } finally {
        await browser.close();
    }
  })();
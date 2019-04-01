#!/usr/bin/env node

'use strict'

var fs = require('fs');
var path = require('path');

const program = require('commander');
const puppeteer = require('puppeteer');

var input = null;
var output = null;

program
  .name('drawio-export-cli')
  .version(require('./package.json').version)
  .arguments('<source> <destination>')
  .action(function (source, destination) {
    input = source
    output = destination
  })
  .parse(process.argv);

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-web-security'], 
        //devtools: true
    });

    try {
        var file = await fs.readFileSync(input, 'utf-8');

        const page = await browser.newPage();
        await page.goto('file://' + __dirname + '/views/export.html');

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
        
        
        data.forEach(async item => {
            var filename = path.parse(output);
            var exists = await fs.existsSync(filename.dir);
            if(!exists){
                await fs.mkdirSync(filename.dir);
            }

            var out = path.join(filename.dir, filename.name + "." + item.name + filename.ext);
            await fs.writeFileSync(out, item.data, function(err) {
                if (err) {
                    return console.log(err)
                }
            });    
        });
        
    } catch (error) {
        console.log(error)
        process.exit(1)
    } finally {
        await browser.close()
    }
  })();
#!/usr/bin/env node
var program = require('commander');

program
    .version('0.2.0');

program
    .command('create [name]')
    .description('create a page')
    .action(function(name){
        console.log('create', name);
    });

program
    .command('copy [name]')
    .description('copy a page to different path')
    .action(name => {
        console.log('copy', name);
    });

program.parse(process.argv);
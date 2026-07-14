"use strict";

import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { default as dns } from 'node:dns/promises';

import Mustache from 'mustache';
import { globSync } from 'glob';
import chokidar from 'chokidar';
import { makeRetriable } from 'p-retry';

// check for mandatory envorinmental variables
if (!process.env.CSYNC2_PSK_FILE) {
    console.error(new Date(), 'CSYNC2_PSK_FILE must be set');
    process.exit(1);
}

// read multiple INCLUDE and EXCLUDE variables
const includeGlobs = [];
const excludes = [];
for (let variable of Object.keys(process.env)) {
    if (variable.startsWith('CSYNC2_INCLUDE')) {
        includeGlobs.push(process.env[variable]);
    }
    if (variable.startsWith('CSYNC2_EXCLUDE')) {
        excludes.push(process.env[variable]);
    }
}

// parse globs from includes to pass to file watcher
console.log(new Date(), 'Found', includeGlobs.length, 'globs to include');
if (process.env.DEBUG) console.debug(new Date(), 'includeGlobs', includeGlobs);
const includes = globSync(includeGlobs);
if (process.env.DEBUG ) console.debug(new Date(), 'includes', includes);
console.log(new Date(), 'Found', includes.length, 'paths/files to include');

// no need to parse excludes, because these are passed directly to csync2
console.log(new Date(), 'Found', excludes.length, 'patterns to exclude');

// start the csync2 daemon
let csync2d, watcher;
csync2d = spawn ('csync2', ['-ii', process.env.CSYNC2_DAEMON_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR,  '-p', process.env.CSYNC2_PORT], {
    stdio: ['ignore', 'inherit', 'inherit']
});
// exit immediately if the daemon doesn't start successfully
csync2d.on('error', (error) => {
    console.error(new Date(), error);
    process.exit(1);
});
// sync once when the daemon successfully starts (the first thing it does is print to the console)
csync2d.once('spawn', () => {
    if (process.env.DEBUG) console.debug(new Date(), 'daemon spawned');
    // give the daemon 5000 ms to start
    setTimeout(async function start() {
        // initial sync
        console.info(new Date(), 'Performing initial sync...');
        await sync();
        // create the file watcher with chokidar
        console.info(new Date(), 'Initializing flie watcher...');
        watcher = chokidar.watch(includes);
        // run sync on file changes
        watcher.on('all', makeRetriable(sync));
    }, 5000);
});
// handle exit, stopping the client
csync2d.on('exit', exit);

// mustache things
const cfgTemplate = readFileSyc(process.env.CSYNC2_TEMPLATE_FILE, 'utf8');
// initialize mustache, no escapes
Mustache.parse(cfgTemplate);
Mustache.escape = (x) => { return x; };

// object to render with mustache template
const cfg = {
    hosts: [],
    key: process.env.CSYNC2_PSK_FILE,
    includes: includes,
    excludes: excludes,
    auto: process.env.CSYNC2_AUTO,
    backupDirectory: process.env.CSYNC2_BACKUP_DIRECTORY,
    backupGenerations: process.env.CSYNC2_BACKUP_GENERATIONS
};

// main function
async function sync() {
    // get peers by IP, hitting the docker dns endpoint
    const taskLookups = [];
    const aRecords = await dns.lookup(process.env.FAVRE_TASKS_ENDPOINT, { all: true });
    for (let record of aRecords) {
        taskLookups.push(dns.reverse(record.address));
    }
    // get resolvable task hosts
    const endpoints = [];
    const tasks = await Promise.all(taskLookups);
    if (process.env.DEBUG) console.debug(new Date(), 'tasks:', '\n', tasks);
    for (let task of tasks) {
        // change reverse dns to match hostname
        let remote = task[0].split('.').slice(0,3).toString().replaceAll(',','.');
        if (process.env.DEBUG) console.debug(new Date(), 'Found remote', remote);
        endpoints.push(remote);
    }
    if (process.env.DEBUG) console.debug(new Date(), 'endpoints:', '\n', endpoints);

    // use setImmediate to ensure that the tasks lookup is finished
    setImmediate(() => {
        // cfg.hosts is from the last run (or empty if this is the first run)
        // if there is a host from the last run that is not in the new array, clean the database
        if (process.env.DEBUG) console.debug(new Date(), 'cfg.hosts:', '\n', cfg.hosts);
        for (let host of cfg.hosts) {
            if (!endpoints.includes(host)) {
                execFileSync('csync2', ['-R', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR, '-p', process.env.CSYNC2_PORT]);
                if (process.env.DEBUG) console.debug(new Date(), 'Database cleaned');
                break;
            }
        }

        // update config for template
        cfg.hosts = endpoints;
        const configFile = Mustache.render(cfgTemplate, cfg);
        if (process.env.DEBUG) console.debug(new Date(), 'configFile:', '\n', configFile);
        writeFileSync(`${process.env.CSYNC2_SYSTEM_DIR}/csync2.cfg`, configFile);

        // run the synchronization operation
        if (process.env.DEBUG) console.debug(new Date(), 'Running csync2...');
        execFileSync('csync2', ['-x', '-r', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR,  '-p', process.env.CSYNC2_PORT], {
            timeout: Number.parseInt(process.env.CSYNC2_TIMEOUT)
        });
    });
}

// clean exit, stopping both the client and the server
function exit(signal) {
    // acknowledge receipt
    console.log(new Date(), signal, 'received');
    console.log(new Date(), 'Exiting...');

    // remove the watcher
    if (watcher) {
        // this method is async, but there is no need to await it
        watcher.close();
    }

    // stop the daemon
    if (csync2d) {
        csync2d.kill();
    }
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
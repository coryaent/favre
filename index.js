"use strict";

const dns = require ('node:dns').promises;
const { spawn, execFileSync } = require ('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const Mustache = require ('mustache');

if (!process.env.CSYNC2_KEY_FILE) {
    console.error ('CSYNC2_KEY_FILE must be set');
    process.exit (1);
}

// start the csync2 daemon
const csync2d = spawn ('csync2', ['-ii', process.env.CSYNC2_DAEMON_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR], {
    stdio: ['ignore', 'inherit', 'inherit']
});

// mustache things
const cfgTemplate = `
nossl * *;

group swarm {

    {{#hosts}}
    host {{.}};
    {{/hosts}}

    key {{key}};

    {{#includes}}
    include {{.}};
    {{/includes}}

    {{#excludes}}
    exclude {{.}};
    {{/excludes}}

    {{#auto}}auto {{.}};{{/auto}}

    {{#backupDirectory}}backup-directory {{.}};{{/backupDirectory}}
    {{#backupGenerations}}backup-generations {{.}};{{/backupGenerations}}
}
`;
// initialize mustache, no escapes
Mustache.parse (cfgTemplate);
Mustache.escape = (x) => {return x;};

// read env configuration options
const includes = [];
const excludes = [];
for (let variable of Object.keys (process.env)) {
    if (variable.startsWith ('CSYNC2_INCLUDE')) {
        includes.push (process.env[variable]);
    }
    if (variable.startsWith ('CSYNC2_EXCLUDE')) {
        excludes.push (process.env[variable]);
    }
}
console.log ('Found', includes.length, 'paths to include.');
console.log ('Found', excludes.length, 'patterns to exclude.');

// object to render with mustache template
const cfg = {
    hosts: [],
    key: process.env.CSYNC2_KEY_FILE,
    includes: includes,
    excludes: excludes,
    auto: process.env.CSYNC2_AUTO,
    backupDirectory: process.env.CSYNC2_BACKUP_DIRECTORY,
    backupGenerations: process.env.CSYNC2_BACKUP_GENERATIONS
};

// main function
async function sync () {
    // get peers by IP
    let taskLookups = [];
    let aRecords = await dns.lookup (process.env.FAVRE_TASKS_ENDPOINT, { all: true });
    for (let record of aRecords) {
        taskLookups.push (dns.reverse (record.address));
    }
    // get resolvable task hosts
    let hosts = [];
    let tasks = await Promise.all (taskLookups);
    for (let task of tasks) {
        // change reverse dns to match hostname
        let remote = task[0].split ('.').slice (0,3).toString ().replaceAll (',','.');
        hosts.push (remote);
    }
    console.log ('Found', hosts.length, 'hosts.');
    // no need to sync with self
    if (hosts.length > 1) {
        // update config
        cfg.hosts = hosts;
        const configFile = Mustache.render (cfgTemplate, cfg);
        console.log ('Writing config file', configFile);
        fs.writeFileSync (`${process.env.CSYNC2_SYSTEM_DIR}/csync2.cfg`, configFile);
        // execute the synchronization
        try {
            execFileSync ('csync2', ['-x', '-r', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
        } catch (error) {
            console.error (error);
        }
    }
}

// run sync function periodically
let syncInterval = setInterval (sync, Number.parseInt (process.env.CSYNC2_SYNC_INTERVAL));

// exit
process.on ('SIGTERM', () => {
    console.log ('SIGTERM received.');
    console.log ('Shutting down...');
    clearInterval (syncInterval);
    csync2d.kill ();
});

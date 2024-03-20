"use strict";

const dns = require ('node:dns').promises;
const { spawn, execFileSync } = require ('node:child_process');
const watch = require ('node-watch');
const Mustache = require ('mustache');
const fs = require('node:fs');
const os = require('node:os');

if (!process.env.CSYNC2_KEY_FILE) {
    console.error ('CSYNC2_KEY_FILE must be set');
    process.exit (1);
}

// start the csync2 daemon
const csync2d = spawn ('csync2', ['-ii', '-vvv', '-D', process.env.CSYNC2_DB_DIR], {
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
    let hosts = [os.hostname()];
    let tasks = await Promise.all (taskLookups);
    for (let task of tasks) {
        hosts.push (task[0]);
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
        execFileSync ('csync2', ['-x', '-r', '-vvv', '-D', process.env.CSYNC2_DB_DIR]);

    }
}

// watch filesystem for changes
const watcher = watch (includes, {
    recursive: true,
    delay: Number.parseInt (process.env.FAVRE_DEBOUNCE_DELAY)
})
.on ('ready', () => {
    console.log ('Watcher ready.');
    sync ();
})
.on ('change', () => {
    console.log ('Detected file change');
    sync ();
});

// exit
process.on ('SIGTERM', () => {
    console.log ('SIGTERM received.');
    console.log ('Shutting down...');
    watcher.close ();
    csync2d.kill ();
});

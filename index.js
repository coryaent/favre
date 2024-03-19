"use strict";

const dns = require ('node:dns').promises;
const { spawn, execFileSync } = require ('node:child_process');
const watch = require ('node-watch');
const Mustache = require ('mustache');

// start the csync2 daemon
const csync2d = spawn ('csync2', ['-ii', '-vvvv', '-D', process.env.CSYNC2_DB_FILE], {
    stdio: ['ignore', 'inherit', 'inherit']
})

// mustache things
const cfgTemplate = `
nossl * *;

group synchronization {

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

    auto {{auto}};
}
`;
Mustache.parse (cfgTemplate);
Mustache.escape = (x) => {return x;};

// default and ENV configuration
const includes = [];
const excludes = [];
for (let variable of Object.keys (process.env)) {
    if (variable.startsWith ('FAVRE_INCLUDE')) {
        includes.push (process.env[variable]);
    }
    if (variable.startsWith ('FAVRE_EXCLUDE')) {
        excludes.push (process.env[variable]);
    }
}
const cfg = {
    hosts: [],
    key: process.env.CSYNC2_KEY_FILE,
    includes: includes,
    excludes: excludes,
    auto: process.env.CSYNC2_AUTO ? process.env.CSYNC2_AUTO : 'younger'
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
    let tasks = await Promise.all (taskLookups);
    let hosts = [];
    for (let task of tasks) {
        hosts.push (task[0]);
    }
    // update config
    cfg.hosts = hosts;
    fs.writeFileSync (process.env.CSYNC2_CONFIG_FILE, Mustache.render (cfgTemplate, cfg));
    // execute the synchronization
    execFileSync ('csync2', ['-x', '-r', '-D', DB]);
}

// watch filesystem for changes
const watcher = watch ('/sync', {
    recursive: true,
})
.on ('ready', sync)
.on ('change', sync);

// exit
process.on ('SIGINT', () => {
    console.info ('SIGINT ignored.');
});

process.on ('SIGTERM', () => {
    console.log ('SIGTERM received.');
    console.log ('Shutting down...');
    watcher.close ();
    csync2d.kill ();
});

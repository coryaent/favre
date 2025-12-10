"use strict";

import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { parse, escape, render } from 'mustache';
import { globSync } from 'glob';
import chokidar from 'chokidar';

// check for mandatory envorinmental variables
if (!process.env.CSYNC2_PSK_FILE) {
    console.error (new Date (), 'CSYNC2_PSK_FILE must be set');
    process.exit (1);
}

// read multiple INCLUDE and EXCLUDE variables
const includeGlobs = [];
const excludes = [];
for (let variable of Object.keys (process.env)) {
    if (variable.startsWith ('CSYNC2_INCLUDE')) {
        includeGlobs.push (process.env[variable]);
    }
    if (variable.startsWith ('CSYNC2_EXCLUDE')) {
        excludes.push (process.env[variable]);
    }
}

// parse globs from includes to pass to file watcher
console.log (new Date (), 'Found', includeGlobs.length, 'globs to include');
const includes = globSync(includeGlobs);
console.log(new Date(), 'Found', includes.lengeth, 'paths/files to include');

// no need to parse excludes, because these are passed to csync2
console.log (new Date (), 'Found', excludes.length, 'patterns to exclude');

// start the csync2 daemon
const csync2d = spawn ('csync2', ['-ii', process.env.CSYNC2_DAEMON_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
// exit immediately if the daemon doesn't start successfully
csync2d.on('error', (error) => {
    console.error(new Date(), error);
    process.exit(1);
});
// sync once when the daemon successfully starts (the first thing it does is print to the console)
csync2d.stdout.once('data', sync);
// handle exit, stopping the client
csync2d.on('exit', () => {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
});

// mustache things
const cfgTemplate = `
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
parse (cfgTemplate);
escape = (x) => {return x;};

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
async function sync () {
    // fetch the list of nodes with all the gory details
    let response = await fetch(`http://${process.env.FAVRE_DOCKER_HOST}/${process.env.FAVRE_DOCKER_API_VERSION}/nodes`);
    // reduce to just hostnames
    const nodes = (await response.json()).map(node => node.Description.Hostname);
    // cfg.hosts is from the last run (or empty if this is the first run)
    // if there is a host from the last run that is not in the new array, clean the database
    for (let host of cfg.hosts) {
        if (!nodes.includes(host)) {
            execFileSync ('csync2', ['-R', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
            break;
        }
    }
    // update config for template
    cfg.hosts = nodes;
    const configFile = render(cfgTemplate, cfg);
    writeFileSync(`${process.env.CSYNC2_SYSTEM_DIR}/csync2.cfg`, configFile);
    // run the synchronization operation
    execFileSync ('csync2', ['-x', '-r', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
}

// run sync function periodically (won't go faster than every second)
syncInterval = setInterval (sync, Number.parseInt(process.env.CSYNC2_SYNC_INTERVAL) * 1000 || 1000);

// clean exit, stopping both the client and the server
function exit(signal) {
    // acknowledge receipt
    console.log(new Date(), signal, 'received');
    console.log(new Date(), 'Exiting...');
    // stop the client running at an interval
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    // stop the daemon
    csync2d.kill();
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
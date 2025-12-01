"use strict";

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');

const Mustache = require ('mustache');

// check for mandatory envorinmental variables
if (!process.env.CSYNC2_PSK_FILE) {
    console.error (new Date (), 'CSYNC2_PSK_FILE must be set');
    process.exit (1);
}

if (!process.env.FAVRE_DOCKER_HOST) {
    console.error (new Date (), 'FAVRE_DOCKER_HOST must be set');
    process.exit (1);
}

// check if the key exists and generate a new one if it doesn't
let keyPath = process.env.CSYNC2_SYSTEM_DIR + '/csync2_ssl_key.pem';
if (!fs.existsSync(keyPath)) {
    execFileSync('openssl', ['genrsa', '-out', keyPath, process.env.CSYNC2_SSL_BIT_LENGTH]);
}

// check if the cert exists and create/sign a new one if it doesn't
let certPath = process.env.CSYNC2_SYSTEM_DIR + '/csync2_ssl_cert.pem';
if (!fs.existsSync(certPath)) {
    // create a new signing request
    execFileSync('openssl', ['req', '-new',
        '-key', certPath,
        '-out', process.env.CSYNC2_SYSTEM_DIR + '/csync2_ssl_cert.csr'
    ]);
    // create a new self-signed cert
    execFileSync('openssl', ['x509', '-req', '-days', process.env.CSYNC2_SSL_EXPIRY_DAYS,
        '-in', process.env.CSYNC2_SYSTEM_DIR + '/csync2_ssl_cert.csr',
        '-signkey', keyPath,
        '-out', certPath
    ]);
}

// read multiple INCLUDE and EXCLUDE variables
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
console.log (new Date (), 'Found', includes.length, 'paths to include');
console.log (new Date (), 'Found', excludes.length, 'patterns to exclude');

// this will be used as the holder of the setInterval function output
let syncInterval;
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
Mustache.parse (cfgTemplate);
Mustache.escape = (x) => {return x;};

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
    // cfg.hosts is from the last run
    // if there is a host from the last run that is not in the new array, clean the database
    for (let host of cfg.hosts) {
        if (!nodes.includes(host)) {
            execFileSync ('csync2', ['-R', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
            break;
        }
    }
    // update config for template
    cfg.hosts = nodes;
    const configFile = Mustache.render(cfgTemplate, cfg);
    fs.writeFileSync(`${process.env.CSYNC2_SYSTEM_DIR}/csync2.cfg`, configFile);
    // run the synchronization operation
    execFileSync ('csync2', ['-x', '-r', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
}

// run sync function periodically (won't go faster than every second)
syncInterval = setInterval (sync, Number.parseInt(process.env.CSYNC2_SYNC_INTERVAL) * 1000 || 1000);

// clean exit
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
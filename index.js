"use strict";

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const Mustache = require ('mustache');

// check for mandatory envorinmental variables
if (!process.env.CSYNC2_PSK_FILE) {
    console.error (new Date (), 'CSYNC2_PSK_FILE must be set');
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
// handle exit (code will be null if it was stopped intentionally, such as with the exit() method)
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
    // get peers by IP
    // let taskLookups = [];
    // let aRecords = await dns.lookup (process.env.FAVRE_TASKS_ENDPOINT, { all: true });
    // for (let record of aRecords) {
    //     taskLookups.push (dns.reverse (record.address));
    // }
    // // get resolvable task hosts
    // let hosts = [];
    // let tasks = await Promise.all (taskLookups);
    // for (let task of tasks) {
    //     // change reverse dns to match hostname
    //     let remote = task[0].split ('.').slice (0,3).toString ().replaceAll (',','.');
    //     console.debug (new Date (), 'Found remote', remote);
    //     hosts.push (remote);
    // }
    // console.debug (new Date (), 'Found', hosts.length, 'hosts');
    // // no need to sync with self
    // if (hosts.length > 1) {
    //     // update config
    //     cfg.hosts = hosts;
    //     const configFile = Mustache.render (cfgTemplate, cfg);
    //     console.log (new Date (), 'Writing config file', configFile);
    //     fs.writeFileSync (`${process.env.CSYNC2_SYSTEM_DIR}/csync2.cfg`, configFile);
    //     try {
    //         // clean database
    //         execFileSync ('csync2', ['-R', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
    //         // execute the synchronization
    //         execFileSync ('csync2', ['-x', '-r', process.env.CSYNC2_CLIENT_VERBOSITY, '-D', process.env.CSYNC2_DB_DIR]);
    //     } catch (error) {
    //         // print error and exit with code 1
    //         console.error (new Date (), error);
    //         clearInterval (syncInterval);
    //         csync2d.once ('exit', () => {
    //             process.exit (1);
    //         });
    //         csync2d.kill ();
    //     }
    // }
}

// run sync function periodically
syncInterval = setInterval (sync, Number.parseInt(process.env.CSYNC2_SYNC_INTERVAL) * 1000);

// clean exit
function exit(signal) {
    // acknowledge receipt
    console.log(new Date(), signal, 'received');
    console.log(new Date(), 'Exiting...');
    // stop the client running at an interval
    if (syncInterval) {
        clearInterval (syncInterval);
    }
    // stop the daemon
    csync2d.kill ();
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
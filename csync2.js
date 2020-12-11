"use strict";

const os = require ('os');
const fs = require ('fs');
const { spawn, execFileSync, execSync } = require ('child_process');

// make relevent directory and chown
try {
    execFileSync ('make_and_take');
} catch (error) {
    console.error ('Error in native initialization binary.');
    process.exitCode = 1;
};

const cfgTemplate = `
no ssl * *;

group syncronization {
    
    {{#hosts}}
    host {{.}};
    {{/hosts}}

    key {{key}};

    include /sync;

    {{#excludes}}
    exclude {{.}};
    {{/excludes}}

    auto younger;
}
`;

const Mustache = require ('mustache');
Mustache.parse (cfgTemplate);

// keep DB in RAM
const DB_FLAG = '-D /run/csync2/db';

// track which hosts are online
const hosts = new Set ([os.hostname()]);
module.exports.hosts = hosts;

// config
process.env.CSYNC2_SYSTEM_DIR = '/run/csync2'; // make sure this is set
const cfg = {    
    key: process.env.KEY_FILE ? process.env.KEY_FILE : '/run/secrets/csync2.psk',
    excludes: process.env.EXCLUDE,
};

module.exports.daemon = {
    start: () => {
        return spawn ('csync2', ['-ii', '-vv'], {
            stdio: ['ignore', 'inherit', 'inherit']
        })
        .on ('error', (error) => {
            console.error ('Failed to start Csync2 subprocess.');
            console.error (error);
            process.exitCode = 1;
        });
    }
};

module.exports.sync = () => {
    cfg.hosts = Array.from (hosts);
    fs.writeFileSync (
        '/run/csync2/csync2.cfg',
        Mustache.render (cfgTemplate, cfg)
    );
    const cmd = (`csync2 -x -r -v ${DB_FLAG}`);
    console.log (`Running ${cmd}...`);
    execSync (cmd, (error, stdout, stderr) => {
        if (error) {
            console.error (error);
            return;
        };
        console.log (stdout);
        console.error (stderr);
    });
};

module.exports.flush = () => {
    cfg.hosts = Array.from (hosts.values());
    fs.writeFileSync (
        '/run/csync2/csync2.cfg',
        Mustache.render (cfgTemplate, cfg)
    );
    const cmd = (`csync2 -R ${DB_FLAG}`);
    console.log (`Running ${cmd}...`);
    execSync (cmd, (error, stdout, stderr) => {
        if (error) {
            console.error (error);
            return;
        };
        console.log (stdout);
        console.error (stderr);
    });
};
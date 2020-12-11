"use strict";

const fs = require ('fs');
const { spawn, execSync } = require ('child_process');

const cfgTemplate = `
no ssl * *;

group syncronization {
    
    {{#hosts}}
    host {{.}};
    {{/hosts}}

    key {{key}};

    include {{include}};

    exclude {{exclude}};

    auto younger;
}
`;

const Mustache = require ('mustache');
Mustache.parse (cfgTemplate);

// keep DB in RAM
const DB_FLAG = '-D /run/csync2/db';

// config
process.env.CSYNC2_SYSTEM_DIR = '/run/csync2';
const cfg = {
    hosts: [],
    key: process.env.KEY_FILE ? process.env.KEY_FILE : '/run/secrets/csync2.psk',
    include: process.env.SYNC_DIR ? process.env.SYNC_DIR : '/sync',
    exclude: process.env.EXCLUDE,
};

module.exports = {
    daemon: {
        start: spawn ('csync2', ['ii', 'vv'])
        .stdout.on ('data', (data) => {
            console.log (data);
        })
        .stderr.on ('data', (data) => {
            console.error (data);
        })
        .on ('error', (error) => {
            console.error ('Failed to start Csync2 subprocess.');
            console.error (error);
            process.exit (1);
        })
    },
    sync: (hosts) => {
        cfg.hosts = Array.from (hosts.values());
        fs.writeFileSync (
            '/run/csync2/csync2.cfg',
            Mustache.render (cfgTemplate, cfg)
        );
        const cmd = (`csync2 -R ${DB_FLAG}`);
        console.log (`Running ${cmd}`);
        execSync (cmd, (error, stdout, stderr) => {
            if (error) {
                console.error (error);
                return;
            };
            console.log (stdout);
            console.error (stderr);
        });
    },
    flush: (hosts) => {
        cfg.hosts = Array.from (hosts.values());
        fs.writeFileSync (
            '/run/csync2/csync2.cfg',
            Mustache.render (cfgTemplate, cfg)
        );
        execSync (cmd, (error, stdout, stderr) => {
            if (error) {
                console.error (error);
                return;
            };
            console.log (stdout);
            console.error (stderr);
        });
    }
};
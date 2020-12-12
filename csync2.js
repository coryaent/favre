"use strict";

const os = require ('os');
const fs = require ('fs');
const { spawn, execFileSync } = require ('child_process');

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
Mustache.escape = (x) => {return x;};

// track which hosts are online
const hosts = new Set ([os.hostname()]);
module.exports.hosts = hosts;

// config
process.env.CSYNC2_SYSTEM_DIR = '/run/csync2'; // make sure this is set
const cfg = {    
    key: process.env.KEY_FILE ? process.env.KEY_FILE : '/run/secrets/csync2.psk',
    excludes: process.env.EXCLUDE,
};

module.exports.daemon = 
spawn ('csync2', ['-ii', '-vv', '-D', '/run/csync2/db'], {
    stdio: ['ignore', 'inherit', 'inherit']
})
.on ('error', (error) => {
    console.error ('Failed to start Csync2 subprocess.');
    console.error (error);
    process.exitCode = 1;
});

module.exports.sync = () => {
    cfg.hosts = Array.from (hosts.values());
    fs.writeFileSync (
        '/run/csync2/csync2.cfg',
        Mustache.render (cfgTemplate, cfg)
    );
    const cmd = (`csync2 -x -r`);
    console.log (`Running ${cmd}...`);
    try {
        execFileSync ('csync2', ['-x', '-r']);
    } catch (error) {
        console.error (error);
    };
};

module.exports.flush = () => {
    cfg.hosts = Array.from (hosts.values());
    fs.writeFileSync (
        '/run/csync2/csync2.cfg',
        Mustache.render (cfgTemplate, cfg)
    );
    const cmd = (`csync2 -R`);
    console.log (`Running ${cmd}...`);
    try {
        execFileSync ('csync2', ['-R']);
    } catch (error) {
        console.error (error);
    };
};
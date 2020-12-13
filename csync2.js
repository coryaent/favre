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
nossl * *;

group synchronization {
    
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
const DB = '/run/csync2/db';
process.env.CSYNC2_SYSTEM_DIR = '/run/csync2'; // make sure this is set
const cfg = {    
    key: process.env.KEY_FILE ? process.env.KEY_FILE : '/run/secrets/csync2.psk',
    excludes: process.env.EXCLUDE,
};

const updateCfg = function () {
    cfg.hosts = Array.from (hosts.values());
    fs.writeFileSync (
        '/run/csync2/csync2.cfg',
        Mustache.render (cfgTemplate, cfg)
    );
};
module.exports.updateCfg = updateCfg;

module.exports.daemon = 
spawn ('csync2', ['-ii', '-vv', '-D', DB], {
    stdio: ['ignore', 'inherit', 'inherit']
})
.on ('error', (error) => {
    console.error ('Failed to start Csync2 subprocess.');
    console.error (error);
    process.exitCode = 1;
});

module.exports.sync = () => {
    updateCfg ();
    const cmd = (`csync2 -x -r -D ${DB}`);
    console.log (`Running ${cmd}...`);
    try {
        execFileSync ('csync2', ['-x', '-r', '-D', DB]);
    } catch (error) {
        console.error (error);
    };
};

module.exports.flush = () => {
    updateCfg ();
    const cmd = (`csync2 -R -D ${DB}`);
    console.log (`Running ${cmd}...`);
    try {
        execFileSync ('csync2', ['-R', '-D', DB]);
    } catch (error) {
        console.error (error);
    };
};
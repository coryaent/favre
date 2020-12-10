"use strict";

const fs = require ('fs');
const os = require ('os');
const { spawn, exec } = require ('child_process');
const { sleep } = require ('sleepjs');

const Discover = require ('node-discover');
const watch = require ('node-watch');

import Hosts from 'hosts-so-easy';
const Mustache = require ('mustache');
Mustache.parse (cfgTemplate);

var INITIALIZING = false;

const knownHosts = new Map ();
// hostname -> {
//     online: true || false,
//     ip: 'x.x.x.x'
// }

const hostsFile = new Hosts ({
    atomicWrites: false,
    header: require ('./package.json').npm_package_name
})
.on ('updateStart', () => {
    console.log ('Updates to /etc/hosts are pending...');
})
.on ('updateFinished', (error) => {
    if (!error) {
        console.log ('Successfully updated /etc/hosts.');
    } else {
        console.error (error);
        exit (1);
    };
});

var peers = 0;
const cluster = new Discover ({
    helloInterval: 1 * 1000,
    checkInterval: 2 * 2000,
    nodeTimeout: 10 * 1000,
    address: '0.0.0.0',
    port: 30864,
}, async (error) => {
    // callback on initialization
    if (error) {
        console.error ('Could not start peer discovery.');
        console.error (error);
        process.exit (1);
    };
    // looking for peers
    console.log ('Started peer discovery, looking for peers...');
    INITIALIZING = true;
    await sleep (30 * 1000);
    // add discovered peers to /etc/hosts

    // add this host and peers to config

    // start Csync2 background process

})
.on ('added', function (node) {
    // { 
    //     isMaster: true,
    //     isMasterEligible: true,
    //     advertisement: null,
    //     lastSeen: 1317323922551,
    //     address: '10.0.0.1',
    //     port: 12345,
    //     id: '31d39c91d4dfd7cdaa56738de8240bc4',
    //     hostName : 'myMachine'
    // }
    console.log (`Host ${node.hostName} with ip ${node.address} discovered.`);
    // initial discovery of peers
    if (INITIALIZING) {
        knownHosts.set (node.hostName, {
            online: true,
            ip: node.address
        });
        console.log (`Adding ${node.hostName}@${node.address} to /etc/hosts...`);
        hostsFile.add (node.adddress, node.hostName);
        peers++;
    } else {
        // if the host is in the csync.cfg, upq
    };
})
.on ('removed', function (node) {
	console.log (`Host ${node.hostName} lost.`);
});

// launch csync2 background process
const csync2 = spawn ('csync2', ['ii', 'vv'])
.stdout.on ('data', (data) => {
    console.log (data);
})
.stderr.on ('data', (data) => {
    console.error (data);
})
.on ('close', (code) => {
    console.log (`Csync2 exited with code ${code}.`);
})
.on ('error', (error) => {
    console.error ('Failed to start Csync2 subprocess.');
    console.error (error);
    process.exit (1);
});

// run csync2 sync command
exec ('csync2 -x -r -v', (error, stdout, stderr) => {
    if (error) {
        console.error (error);
        return;
    }
    console.log (stout);
    console.error (stderr);
});

// watch filesystem for changes
const watcher = watch('./', { recursive: true });

watcher.on ('change', function (event, name) {
  // callback
});

watcher.on ('error', function (error) {
  // handle error
});

// graceful exit
async function exit (_code) {
    // check that code is passed and a valid number
    var code = 0;
    if (_code !== undefined && typeof _code === Number) {
        code = _code;
    };

    console.log ('Shutting down...');

    if (watcher) {
        console.log ('Stopping directory watcher...');
        try {
            await watcher.close();
            console.log ('Directory watcher stopped.');
        } catch (error) {
            console.error ('Error stopping directory watcher.')
            console.error (error);
            code++;
        };
    };

    if (cluster) {
        console.log ('Stopping automatic discovery...');
        try {
            await cluster.stop();
            console.log ('Automatic discovery stopped.');
        } catch (error) {
            console.error ('Error stopping automatic discovery.')
            console.error (error);
            code++;
        };
    };

    if (csync2) {
        console.log ('Stopping Csync2 daemon...');
        // should output something
        try {
            await csync2.kill();
        } catch (error) {
            console.error (error);
            code++;
        };
    };

    await sleep (500);

    process.exit (code);
};

process.on ('SIGTERM', () => {
    console.info ('SIGTERM received.');
    exit ();
});

const cfgTemplate = `
no ssl * *;

group syncronization {
    
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

    auto younger;
}
`;
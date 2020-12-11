"use strict";

const os = require ('os');
const { sleep } = require ('sleepjs');
const EventEmitter = require ('events');

const watch = require ('node-watch');
const Discover = require ('node-discover');

// track which hosts are connected
const knownHosts = new Set ([os.hostname()]);

const Csync2 = require ('./csync2.js');

// track initialization
var INITIALIZING = true;
const Initialization = new EventEmitter ()
.on ('done', () => {
    INITIALIZING = false;
    if (knownHosts.size <= 1) {
        console.error ('Could not find any peers.');
        exit (1);
    };
});

// watch filesystem for changes
const watcher = watch(SYNC_DIR, { recursive: true })
.on ('change', function () {
    // ignore events if initializing
    if (!INITIALIZING) {
       Csync2.sync (knownHosts);
    };
})
.on ('error', function (error) {
    console.error (error);
    exit (1);
});

// automatic peer discovery
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
    await sleep (30 * 1000);
    Initialization.emit ('done');

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
    console.log (`Host ${node.hostName} discovered, adding to known hosts...`);
    // initial discovery of peers
    if (INITIALIZING) {
        knownHosts.add (node.hostName);
    } else {
        // update the config and flush the db if host is not known
        if (!knownHosts.has (node.hostName)) {
            knownHosts.add (node.hostName);
            Csync2.sync (knownHosts);
        };
    };
})
.on ('removed', function (node) {
    console.log (`Host ${node.hostName} lost.`);
    knownHosts.delete (node.hostName);
    Csync2.flush (knownHosts);
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

    if (Csync2.daemon) {
        console.log ('Stopping Csync2 daemon...');
        // should output something
        try {
            await Csync2.daemon.kill();
        } catch (error) {
            console.error (error);
            code++;
        };
    };

    await sleep (500);

    process.exit (code);
};

process.on ('SIGINT', () => {
    console.info ('SIGINT ignored.');
});

process.on ('SIGTERM', () => {
    console.info ('SIGTERM received.');
    exit ();
});
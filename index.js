"use strict";

const { sleep } = require ('sleepjs');
const EventEmitter = require ('events');

const watch = require ('node-watch');
const debounce = require ('debounce');
const Discover = require ('node-discover');

const ip = require ('ip');
const iprange = require ('iprange');

// start the csync2 daemon
const Csync2 = require ('./csync2.js');

// track initialization
var INITIALIZING = true;
const Initialization = new EventEmitter ()
.once ('done', () => {
    INITIALIZING = false;
    console.log (`Initialized with ${Csync2.hosts.size - 1} peers.`);
    Csync2.sync ();
});

// watch filesystem for changes
const watcher = watch('/sync', { 
    recursive: true,
})
.on ('ready', () => {
    console.log ('Watching directory /sync for changes...');
})
.on ('change', debounce (() => {
    console.log ('Detected file change.');
    // ignore events if initializing
    if (!INITIALIZING) {
       Csync2.sync ();
    } else {
        console.log ('Wating for initialization...');
    }
}, 5000))
.on ('error', (error) => {
    console.error (error);
    process.exitCode = 1;
});

// automatic peer discovery
const cluster = new Discover ({
    helloInterval: 5 * 1000,
    checkInterval: 2 * 2000,
    nodeTimeout: 30 * 1000,
    address: ip.address(),
    unicast: iprange (`${ip.address()}/24`),
    port: 30864,
}, async (error) => {
    // callback on initialization
    if (error) {
        console.error ('Could not start peer discovery.');
        console.error (error);
        process.exitCode = 1;
    }
    // looking for peers
    console.log ('Started peer discovery, looking for peers...');
    const retries = 3; let attempt = 1;
    while ((Csync2.hosts.size <= 1) && (attempt <= retries)) {
        // backoff
        await sleep ( attempt * 20 * 1000);
        if (Csync2.hosts.size <= 1) {
            console.log (`No peers found. Retrying (${attempt}/${retries})...`);
            attempt++;
        }
    }
    // either move on or quit
    if (Csync2.hosts.size > 1) {
        Initialization.emit ('done');
    } else {
        process.kill (process.pid);
    }

})
.on ('added', function addNode (node) {
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
        Csync2.hosts.add (node.hostName);
        Csync2.updateCfg ();
    } else {
        // sync to new host if unknown
        if (!Csync2.hosts.has (node.hostName)) {
            Csync2.hosts.add (node.hostName);
            Csync2.sync ();
        }
    }
})
.on ('removed', function removeNode (node) {
    console.log (`Host ${node.hostName} lost.`);
    Csync2.hosts.delete (node.hostName);
    Csync2.flush ();
});

// exit
process.on ('SIGINT', () => {
    console.info ('SIGINT ignored.');
});

process.on ('SIGTERM', () => {
    console.log ('SIGTERM received.');
    console.log ('Shutting down...');
    watcher.close ();
    cluster.stop ();
    Csync2.daemon.kill ();
});

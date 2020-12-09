"use strict";

const fs = require ('fs');
const os = require ('os');

const Discover = require('node-discover');
const watch = require ('node-watch');

const cluster = new Discover ({
    helloInterval: 1000,
    checkInterval: 2000,
    nodeTimeout: 2000,
    masterTimeout: 2000,
    address: '0.0.0.0',
    port: 30864
}, (error, success) => {
    // callback for initialization
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
	console.log("A new node has been added.");
})
.on ('removed', function (node) {
	console.log("A node has been removed.");
});
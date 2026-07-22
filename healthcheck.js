"use strict";

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';

// convenience variables
const testDir = tmpdir() + process.env.FAVRE_TMP_SUBFOLDER;
const testFile = testDir + '/test.txt';

// redifine system directory to avoid conflicts with main process
// keep this seperate from testDir to avoid something wonky like trying to csync2 -x the database
process.env.CSYNC2_SYSTEM_DIR = tmpdir() + '/csync2';

// create the requisite directories
mkdirSync(testDir);
mkdirSync(process.env.CSYNC2_SYSTEM_DIR);

// write "favre" to test file
writeFileSync(testFile, 'favre');

// simple config template, no need for mustache
const config = `
nossl * *;

group test {
    host ${hostname()};

    key ${process.env.CSYNC2_PSK_FILE};

    include ${testFile};
}
`;

// write the config
writeFileSync(process.env.CSYNC2_SYSTEM_DIR + '/csync2.cfg', config);

// run the command in dry mode to check if server is healthy
let client = spawn('csync2', ['-x',
    '-d',
    process.env.CSYNC2_CLIENT_VERBOSITY,
    '-D', testDir,
    '-p', process.env.CSYNC2_PORT
], {
    // using pipe for stdin allows the child to be killed when the parent receives SIGKILL
    stdio: ['pipe', 'inherit', 'inherit']
})
// close the parent process when the client is done, passing along the exit code
.on('exit', (code) => {
    process.exit(code ?? 1);
});

// handle healtcheck timeouts and failures
function stop(signal) {
    // stop the currently running client command
    client.kill();
}

// handle these signals gracefully even though they should never be received
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
#!/bin/bash
set -e

# read env files or load defaults
USER_ID=${UID:-1337}
GROUP_ID=${GID:-1337}

# create new user and group with specified id's
groupadd --gid ${GROUP_ID} user
useradd --uid ${USER_ID} --gid ${GROUP_ID} --no-user-group user

# change ownership of the mounted volume in the container
chown -R user:user /sync

# make and change ownership of the csync2 runtime directory
mkdir /run/csync2
chown -R user:user /run/csync2

# start the node app as non-root
gosu user:user node index.js
#!/bin/bash
set -e

# read env files or load defaults
USER_ID=${UID:-1000}
GROUP_ID=${GID:-1000}
CSYNC_HOSTS=${HOSTS:?env variable HOSTS must be set}

# create new user and group with specified id's
groupadd --gid ${GROUP_ID} user
useradd --uid ${USER_ID} --gid ${GROUP_ID} --no-user-group user

# change ownership of the mounted volume in the container
chown -R user:user /sync

# add hosts to /etc/hosts
for i in $(echo $HOSTS | tr ',' '\n')
do
        if [ "$(hostname)" != "$i" ]; then
                printf "%s\t%s\n" $(dig +short $i) $i >> /etc/hosts
        fi
done

printf "Starting Csync2 on %s...\n" $(hostname)
gosu user:user /usr/sbin/csync2 -ii -N $(hostname) &
sleep 15
gosu user:user "$@"

#!/bin/bash
set -e

# read env files or load defaults
USER_ID=${UID:-1000}
GROUP_ID=${GID:-1000}

# create new user and group with specified id's
addgroup -g ${GROUP_ID} user
adduser -u ${USER_ID} -D -H -G user user

# change ownership of the mounted volume in the container
chown -R user:user /sync

su-exec user:user /usr/sbin/csync2 -ii &
su-exec user:user "$@"
su-exec user:user tail -f /dev/null

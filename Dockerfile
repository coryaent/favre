FROM debian:buster AS gcc
WORKDIR /opt
COPY make_and_take.c /opt/make_and_take.c
RUN gcc -o /opt/make_and_take make_and_take.c && \
    chmod ug+s /opt/make_and_take

#####################
# primary container #
#####################
FROM node:12-buster-slim

# expose ports for discovery and Csync2 daemon
EXPOSE 30864/udp
EXPOSE 30865

# copy compiled make_and_take
COPY --from=gcc /opt/make_and_take /usr/local/bin/make_and_take

# install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    csync2=2.0-22-gce67c55-1+deb10u1 libsqlite3-0=3.27.2-3+deb10u1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# install node.js application
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY ["csync2.js", "index.js", "./"]

# use custom nsswitch and keep cync2 dir in RAM
COPY nsswitch.conf /etc/nsswitch.conf
ENV CSYNC2_SYSTEM_DIR /run/csync2

VOLUME ["/sync"]

ENTRYPOINT ["node", "index.js"]

FROM node:12-buster

# expose ports for discovery and Csync2 daemon
EXPOSE 30864
EXPOSE 30865

# install dependencies
RUN apt-get update && apt-get install -y csync2 gosu libsqlite3-0

# install node.js application
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY  ["csync2.js", "index.js", "./"]

# script to add and run-as non-root user
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# use custom nsswitch and keep cync2 dir in RAM
COPY nsswitch.conf /etc/nsswitch.conf
ENV CSYNC2_SYSTEM_DIR /run/csync2

VOLUME ["/sync"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

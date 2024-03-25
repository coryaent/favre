FROM node:20

EXPOSE 30865

# install dependencies and create directory
RUN apt-get update && apt-get install -y --no-install-recommends \
    csync2 libsqlite3-0 && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    mkdir -p /run/csync2

# install node.js application
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY ./index.js ./

# use custom nsswitch
COPY nsswitch.conf /etc/nsswitch.conf

# default ENV
ENV CSYNC2_AUTO=younger
ENV CSYNC2_DB_DIR=/var/lib/csync2
ENV CSYNC2_SYSTEM_DIR=/run/csync2
ENV CSYNC2_DAEMON_VERBOSITY=-v
ENV CSYNC2_CLIENT_VERBOSITY=-v
ENV CSYNC2_SYNC_INTERVAL=5000

ENTRYPOINT ["node", "index.js"]

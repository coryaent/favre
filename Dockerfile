# debian base
FROM node:24.11.1

# default port
EXPOSE 30865

# install dependencies and create directory
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    csync2 openssl && \
    apt-get clean

# debian is weird about respecting this var & creating the csync2 directory
ENV CSYNC2_SYSTEM_DIR=/etc/csync2
RUN mkdir /etc/csync2 && mv /etc/csync2.cfg $CSYNC2_SYSTEM_DIR/

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
ENV CSYNC2_DAEMON_VERBOSITY=-v
ENV CSYNC2_CLIENT_VERBOSITY=-v
ENV CSYNC2_SYNC_INTERVAL=5
ENV CSYNC2_SSL_BIT_LENGTH=4096
ENV CSYNC2_SSL_EXPIRY_DAYS=36500
ENV FAVRE_DOCKER_API_VERSION=v1.52

ENTRYPOINT ["node", "index.js"]

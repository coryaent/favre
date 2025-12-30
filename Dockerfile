# debian base
FROM node:24.11.1

# default port
EXPOSE 30865

# install csync2 debian package
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    csync2=2.0-42-g83b3644-3 && \
    apt-get clean

# debian is weird about respecting this var & creating the csync2 directory,
#   it must be declared explicitly
ENV CSYNC2_SYSTEM_DIR=/etc/csync2
RUN mkdir -p $CSYNC2_SYSTEM_DIR && mv /etc/csync2.cfg $CSYNC2_SYSTEM_DIR/

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

ENTRYPOINT ["node", "index.js"]

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

# use custom nsswitch and
COPY nsswitch.conf /etc/nsswitch.conf

# default ENV
ENV CSYNC2_AUTO=younger
ENV CSYNC2_DB=/var/lib/csync2/favre.db
ENV CSYNC2_SYSTEM_DIR=/run/csync2

ENTRYPOINT ["node", "index.js"]

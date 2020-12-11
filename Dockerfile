FROM node:12-buster

# expose ports for discovery and Csync2 daemon
EXPOSE 30864
EXPOSE 30865

# install dependencies
RUN apt-get update && apt-get install -y csync2 libsqlite3-0

# add SUID takeover program
COPY make_and_take.c make_and_take.c
RUN gcc -o /usr/local/bin/make_and_take \
    make_and_take.c && rm make_and_take.c && \
    chmod ug+s /usr/local/bin/make_and_take

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

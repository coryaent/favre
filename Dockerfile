FROM golang:buster

EXPOSE 30865

RUN apt-get update && apt-get install -y csync2 gosu libsqlite3-0

RUN go get github.com/liujianping/job

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN mkdir /etc/csync2 && \
    chmod 777 /etc/csync2 && \
    chmod 777 /var/lib/csync2 && \
    chmod +x /usr/local/bin/entrypoint.sh

ENV CSYNC2_SYSTEM_DIR /etc/csync2

VOLUME ["/sync"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["job", "-h"]

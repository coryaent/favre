FROM golang:alpine

EXPOSE 30865

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN apk add --no-cache csync2 git su-exec sqlite-dev

RUN go get github.com/liujianping/job

RUN chmod 777 /etc/csync2 && \
    chmod +x /usr/local/bin/entrypoint.sh

VOLUME ["/sync"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["job", "-h"]

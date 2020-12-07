FROM golang:alpine

EXPOSE 30865

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN apk add --no-cache csync2 git su-exec && \
    go get github.com/liujianping/job && \
    chmod 777 /etc/csync2 && \
    chmod +x /usr/local/bin/entrypoint.sh


ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["job", "-h"]

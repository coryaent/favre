FROM golang:alpine

RUN apk add --no-cache csync2 git

RUN go get -v github.com/liujianping/job

ENTRYPOINT ["job"]

CMD ["-h"]
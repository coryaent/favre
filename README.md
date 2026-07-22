# Favre
[![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/github/coryaent/favre?style=flat-square)]([https://libraries.io/github/coryaent/favre](https://img.shields.io/librariesio/github/coryaent/favre
)
[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/coryaent/favre/latest?style=flat-square)](https://hub.docker.com/r/coryaent/favre)

Favre is a wrapper around [Csync2](https://github.com/LINBIT/csync2/blob/master/doc/csync2.adoc) for automatic, eventually-consistent file synchronization within a Docker Swarm.

## Configuration
Many of the configuration options available for Csync2 are available for Favre.

`FAVRE_TASKS_ENDPOINT`: must be set to `"tasks.{{.Service.Name}}."` for discovery

`CSYNC2_AUTO`: defaults to `younger`

`CSYNC2_DB_DIR`: advised to persist with docker volume, default `/var/lib/csync2`; this is where Csync2 stores its state

`CSYNC2_PSK_FILE`: mandatory, no default, should be stored as a docker secret

`CSYNC2_INCLUDE`: globs to include in the sync; more than one line can be rendered by setting `CSYNC2_INCLUDE_0`, `CSYNC2_INCLUDE_1`, etc.

`CSYNC2_EXCLUDE`: patterns to exclude from sync; more than one line can be rendered in the same manner as `CSYNC2_EXCLUDE_0`, `CSYNC2_EXCLUDE_1`, etc.

`CSYNC2_BACKUP_DIRECTORY`: optional, no default

`CSYNC2_BACKUP_GENERATIONS`: optional, no default

`CSYNC2_DB_DIR`: optional, defaults to `/var/lib/csync2`

`CSYNC2_SYSTEM_DIR`: optional, defaults to `/etc/csync2`

`CSYNC2_DAEMON_VERBOSITY`: optional, defaults to `-v`

`CSYNC2_CLIENT_VERBOSITY`: optional, defaults to `-v`

`CSYNC2_PORT`: optional, defaults to `30865`

`CSYNC2_TEMPLATE_FILE`: optional, defaults to a template in the image

`FAVRE_DEBOUNCE_DELAY`: optional; wait this long after a file change is detected before calling `sync()`; defaults to `100` milliseconds

`FAVRE_START_DELAY`: optional; waits some milliseconds after the daemon is spawned before the clients start; defaults to `5000` milliseconds

`FAVRE_REMOVE_TIMEOUT`: optional; timeout for removing unused hosts from the database; defaults to `7500` milliseconds

`FAVRE_SYNC_TIMEOUT`: optional; timeout for sync'ing files; defaults to `90000` milliseconds

`FAVRE_LOOKUP_ATTEMPTS`: optional; how many times should the client attempt to discover its swarm peers; defaults to `5`

`FAVRE_LOOKUP_TIMEOUT`: optional; how long to wait between service discovery queries; defaults to `3000` milliseconds

`FAVRE_TMP_SUBFOLDER`: optional; where the healthcheck puts its test file; defaults to `/favre`

`FAVRE_POLL_INTERVAL`: optional; set an interval for regular sync'ing independent of the file watcher; defaults to `undefined`

## Compose
It is imperative that `hostname` not be changed. The values from a reverse DNS lookup must be marshalled to match this hostname.
```yaml
version: "3.8"

services:
  sync:
    image: coryaent/favre
    hostname: "{{.Task.ID}}"
    secrets:
      - favre_key
    environment:
      CSYNC2_PSK_FILE: /run/secrets/favre_key
      CSYNC2_INCLUDE: /sync
      FAVRE_TASKS_ENDPOINT: "tasks.{{.Service.Name}}."
    networks:
      - internal
    volumes:
      - state:/var/lib/csync2/
      - sync:/sync/
    deploy:
      mode: global
      endpoint_mode: dnsrr

secrets:
  favre_key:
    external: true

networks:
  internal:
    attachable: false
    driver: overlay
    driver_opts:
      encrypted: "true"

volumes:
  state:
    driver: local
  sync:
    driver: local
```

    # Favre
[![Codacy grade](https://img.shields.io/codacy/grade/8218e0ae989143c3b4c3cc6a75235756?style=flat-square)](https://app.codacy.com/gh/coryaent/favre/dashboard)
[![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/github/coryaent/favre?style=flat-square)](https://libraries.io/github/coryaent/favre)
[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/coryaent/favre/latest?style=flat-square)](https://hub.docker.com/r/stevecorya/favre)

Favre is a wrapper around [Csync2](https://github.com/LINBIT/csync2/blob/master/doc/csync2.adoc) for automatic, eventually-consistent file synchronization within a Docker Swarm.

## Configuration
Many of the configuration options available for Csync2 are available for Favre. These environmental variables will be rendered into a file `/run/csync2/csync2.cfg` prior to running `csync2`.

`CSYNC2_AUTO`: defaults to `younger`

`CSYNC2_DB_DIR`: advised to persist with docker volume, default `/var/lib/csync2`; this is where Csync2 stores its state

`CSYNC2_KEY_FILE`: mandatory, no default, should be stored as a docker secret

`CSYNC2_INCLUDE`: paths to include in the sync; more than one line can be rendered by setting `CSYNC2_INCLUDE_0`, `CSYNC2_INCLUDE_1`, etc.

`CSYNC2_EXCLUDE`: patterns to exclude from sync; more than one line can be rendered in the same manner as `CSYNC2_EXCLUDE_0`, `CSYNC2_EXCLUDE_1`, etc.

`CSYNC2_BACKUP_DIRECTORY`: optional, no default

`CSYNC2_BACKUP_GENERATIONS`: optional, no default

`CSYNC2_SYSTEM_DIR`: optional, defaults to `/run/csync2`

`CSYNC2_DAEMON_VERBOSITY`: optional, defaults to `-v`

`CSYNC2_CLIENT_VERBOSITY`: optional, defaults to `-v`

`CSYNC2_SYNC_INTERVAL`: mandatory, defaults to `5000` (ms)

`FAVRE_TASKS_ENDPOINT`: must be set to `"tasks.{{.Service.Name}}."` for discovery

## Compose
It is imperative that `hostname` not be changed. The values from a reverse DNS lookup must be marshalled to match this hostname.
```yaml
version: "3.8"

services:
  sync:
    image: coryaent/favre
    hostname: "{{.Service.Name}}.{{.Task.Slot}}.{{.Task.ID}}"
    secrets:
      - favre_key
    environment:
      CSYNC2_KEY_FILE: /run/secrets/favre_key
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

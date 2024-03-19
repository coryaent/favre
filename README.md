[![Codacy grade](https://img.shields.io/codacy/grade/8218e0ae989143c3b4c3cc6a75235756?style=flat-square)](https://app.codacy.com/gh/coryaent/favre/dashboard)
[![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/github/coryaent/favre?style=flat-square)](https://libraries.io/github/coryaent/favre)
[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/stevecorya/favre/latest?style=flat-square)](https://hub.docker.com/r/stevecorya/favre)

Configuration:
`CSYNC2_CONFIG_FILE`: must be writable

`CSYNC2_DB_FILE`

`CSYNC2_KEY_FILE`

`CSYNC2_INCLUDE_0`

`CSYNC2_EXCLUDE_0`

`CSYNC2_AUTO`: none (the default behavior), first (the host on which Csync2 is executed first wins), younger and older (the younger or older file wins), bigger and smaller (the bigger or smaller file wins), left and right (the host on the left side or the right side in the host list wins). Left and right should not be used.

`FAVRE_TASKS_ENDPOINT`

#!/bin/bash

SOURCE="${BASH_SOURCE[0]}"
DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
source "${DIR}/env.sh"

PATH_TO_OPT='/opt/ramiel/ws-scrcpy-ios'
cd "${PATH_TO_OPT}" || exit 1
WS_SCRCPY_CONFIG='/etc/ramiel/ws-scrcpy/ios_settings_local.json' npm start

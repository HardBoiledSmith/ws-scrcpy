#!/bin/bash

__UNAME_MACHINE="$(/usr/bin/uname -m)"
export UNAME_MACHINE="${__UNAME_MACHINE}"
if [[ "$UNAME_MACHINE" == "arm64" ]]; then
  HOMEBREW_PREFIX="/opt/homebrew"
  export PATH="${HOMEBREW_PREFIX}/bin:$PATH"
else
  HOMEBREW_PREFIX="/usr/local"
  export PATH="${HOMEBREW_PREFIX}/bin:$PATH"
fi

PATH_TO_OPT='/opt/ramiel/ws-scrcpy-ios'
cd "${PATH_TO_OPT}" || exit 1
WS_SCRCPY_CONFIG='/etc/ramiel/ws-scrcpy/ios_settings_local.json' npm start

#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

__UNAME_MACHINE="$(/usr/bin/uname -m)"
export UNAME_MACHINE="${__UNAME_MACHINE}"
if [[ "$UNAME_MACHINE" == "arm64" ]]; then
  HOMEBREW_PREFIX="/opt/homebrew"
  export PATH="${HOMEBREW_PREFIX}/bin:$PATH"
else
  HOMEBREW_PREFIX="/usr/local"
  export PATH="${HOMEBREW_PREFIX}/bin:$PATH"
fi

PATH_TO_OPT='/opt/ramiel/ws-scrcpy'
cd "${PATH_TO_OPT}" || exit 1
npm start

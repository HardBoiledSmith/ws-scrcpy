#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

PATH_TO_OPT='/opt/ramiel/ws-scrcpy'
cd "${PATH_TO_OPT}" || exit 1
npm start

# HBsmith 참조
안드로이드 리얼디바이스 장비 지원을 위해 NetrisTV의 ws-scrcpy를 Fork하였음.

## 설치 및 설정
- 저장소 복제
  ```bash
  git clone git@github.com:HardBoiledSmith/ws-scrcpy.git
  ```
- 설정파일 복사
  ```bash
  cd ws-scrcpy/_provisioning/configuration/etc/ramiel/ws-scrcpy || exit -1
  cp settings_local_sample.json settings_local.json
  ```
- 설정파일 수정: `vim settings_local.json`
- 필수 설정 값 확인:
  - `serverPort`: 서버 포트 (default: `28500`)
  - `aesKey`: AES 키
  - `ramielApiServerEndpoint`: ramiel API 서버 엔트포인트. 예) `http://localhost:28000`

## 개발 정책
- 주기적으로 원본 브렌치와 merge
  ```bash
  git remote add upstream https://github.com/NetrisTV/ws-scrcpy.git
  git pull upstream master
  # conflict 제거
  git remote remove upstream
  ```
- code reformatting 사용 지양: 원본 브렌치와의 병합을 위함

## 개발환경에서 지원하는 것들
- 라인 단위 디버깅 & 소스코드 추적
- node 버전 격리: 14 LTS 버전을 권장함
- 변경내용 감지 및 재구성은 지원하지 않음

## 개발환경 구축
- 사용 툴: Pycharm Professional + node.js
- 격리 환경 구축 및 호환되는 node 설치:
  ```bash
  git clone git@github.com:HardBoiledSmith/ws-scrcpy.git

  cd ws-scrcpy

  virtualenv --python=python3.9 venv
  source venv/bin/activate
  pip install nodeenv
  nodeenv --node='14.17.3' --python-virtualenv
  npm install
  ```
- pycharm -> 프로젝트 폴더 선택
- 파이썬 인터프리터 선택
  - Preference -> 검색 -> Python Interpreter -> 새 인터프린터 추가
  - Virtual Environment -> existing environment -> `<현 폴더>/venv/bin/python` -> 확인
- 프로젝트 다시 열기 (모든 환경 적용 위함)
  - Terminal -> `(venv)` 확인
  - node 경로 확인: `which node` -> `<현재 폴더>/venv/bin/node` 확인
- node 인터프리터 선택
  - Preference -> 검색 -> Node Interpreter -> Node.js and NPM
  - Node Interpreter -> ... -> 추가 -> 위에서 확인한 node 경로 붙여넣기
- 실행 환경 추가: Pycharm -> Edit Configurations -> Add New Configuration -> Node.js
  - Name: `ws-scrcpy` (임의로 설정)
  - Working directory: `<PATH_TO_WORKING_DIR>/ws-scrcpy`
  - JavaScript file: `dist/index.js`
  - Before launch -> Add -> Run npm script -> command=`run`, script=`dist:dev`


# ws scrcpy

Web client for [Genymobile/scrcpy][scrcpy] and more.

## Requirements

Browser must support the following technologies:
* WebSockets
* Media Source Extensions and h264 decoding;
* WebWorkers
* WebAssembly

Server:
* Node.js v10+
* node-gyp ([installation](https://github.com/nodejs/node-gyp#installation))
* `adb` executable must be available in the PATH environment variable

Device:
* Android 5.0+ (API 21+)
* Enabled [adb debugging](https://developer.android.com/studio/command-line/adb.html#Enabling)
* On some devices, you also need to enable
[an additional option](https://github.com/Genymobile/scrcpy/issues/70#issuecomment-373286323)
to control it using keyboard and mouse.

## Build and Start

Make sure you have installed [node.js](https://nodejs.org/en/download/),
[node-gyp](https://github.com/nodejs/node-gyp) and
[build tools](https://github.com/nodejs/node-gyp#installation)
```shell
git clone https://github.com/NetrisTV/ws-scrcpy.git
cd ws-scrcpy

## For stable version find latest tag and switch to it:
# git tag -l
# git checkout vX.Y.Z

npm install
npm start
```

## Supported features

### Android

#### Screen casting
The modified [version][fork] of [Genymobile/scrcpy][scrcpy] used to stream
H264-video, which then decoded by one of included decoders:

##### Mse Player

Formerly "native". Based on [xevokk/h264-converter][xevokk/h264-converter].
HTML5 Video.<br>
Requires [Media Source API][MSE] and `video/mp4; codecs="avc1.42E01E"`
[support][isTypeSupported]. Creates mp4 containers from NALU, received from a
device, then feeds them to [MediaSource][MediaSource]. In theory, it can use
hardware acceleration.

##### Broadway Player

Based on [mbebenita/Broadway][broadway] and
[131/h264-live-player][h264-live-player].<br>
Requires [WebAssembly][wasm] and preferably [WebGL][webgl] support.

##### TinyH264 Player

Based on [udevbe/tinyh264][tinyh264].<br>
Requires [WebAssembly][wasm], [WebWorkers][workers], [WebGL][webgl] support.

#### Remote control
* Touch events (including multi-touch)
* Multi-touch emulation: <kbd>CTRL</kbd> to start with center at the center of
the screen, <kbd>SHIFT</kbd> + <kbd>CTRL</kbd> to start with center at the
current point
* Capturing keyboard events
* Injecting text (ASCII only)
* Copy to/from device clipboard
* Device "rotation"

#### File push
Drag & drop an APK file to push it to the `/data/local/tmp` directory. You can
install it manually from the included [xtermjs/xterm.js][xterm.js] terminal
emulator (see below).

#### Remote shell
Control your device from `adb shell` in your browser.

#### Debug WebPages/WebView
[/docs/Devtools.md](/docs/Devtools.md)

### iOS

***Experimental Feature***: *is not built by default*
(see [custom build](#custom-build))

#### Screen Casting

Requires [ws-qvh](https://github.com/NetrisTV/ws-qvh) available in `PATH`.

#### Remote control

To control device we use [appium/WebDriverAgent][WebDriverAgent].
Functionality limited to:
* Simple touch
* Scroll
* Home button click

Make sure you did properly [setup WebDriverAgent](https://appium.io/docs/en/drivers/ios-xcuitest-real-devices/).
WebDriverAgent project is located under `node_modules/appium-webdriveragent/`.

## Custom Build

You can customize project before build by overriding the
[default configuration](/webpack/default.build.config.json) in
[build.config.override.json](/build.config.override.json):
* `INCLUDE_APPL` - include code for iOS device tracking and control
* `INCLUDE_GOOG` - include code for Android device tracking and control
* `INCLUDE_ADB_SHELL` - remote shell for android devices
([xtermjs/xterm.js][xterm.js], [Tyriar/node-pty][node-pty])
* `INCLUDE_DEV_TOOLS` - dev tools for web pages and web views on android
devices
* `USE_BROADWAY` - include [Broadway Player](#broadway-player)
* `USE_H264_CONVERTER` - include [Mse Player](#mse-player)
* `USE_TINY_H264` - include [TinyH264 Player](#tinyh264-player)

## Run configuration

You can specify a path to a configuration file in `WS_SCRCPY_CONFIG`
environment variable.
Configuration file format: [source](/src/types/Configuration.d.ts).

Parameters explanation: **TBD**.

## Known issues

* The server on the Android Emulator listens on the internal interface and not
available from the outside. Select `proxy over adb` from the interfaces list.
* TinyH264Player may fail to start, try to reload the page.
* MsePlayer reports too many dropped frames in quality statistics: needs
further investigation.
* On Safari file upload does not show progress (it works in one piece).

## Security warning
Be advised and keep in mind:
* There is no encryption between browser and node.js server (plain HTTP).
* There is no encryption between browser and WebSocket server (plain WS).
* There is no authorization on any level.
* The modified version of scrcpy with integrated WebSocket server is listening
for connections on all network interfaces.
* The modified version of scrcpy will keep running after the last client
disconnected.

## Related projects
* [Genymobile/scrcpy][scrcpy]
* [xevokk/h264-converter][xevokk/h264-converter]
* [131/h264-live-player][h264-live-player]
* [mbebenita/Broadway][broadway]
* [DeviceFarmer/adbkit][adbkit]
* [xtermjs/xterm.js][xterm.js]
* [udevbe/tinyh264][tinyh264]

## scrcpy websocket fork

Currently, support of WebSocket protocol added to v1.17 of scrcpy
* [Prebuilt package](/vendor/Genymobile/scrcpy/scrcpy-server.jar)
* [Source code][fork]

[fork]: https://github.com/NetrisTV/scrcpy/tree/feature/websocket-v1.17.x

[scrcpy]: https://github.com/Genymobile/scrcpy
[xevokk/h264-converter]: https://github.com/xevokk/h264-converter
[h264-live-player]: https://github.com/131/h264-live-player
[broadway]: https://github.com/mbebenita/Broadway
[adbkit]: https://github.com/DeviceFarmer/adbkit
[xterm.js]: https://github.com/xtermjs/xterm.js
[tinyh264]: https://github.com/udevbe/tinyh264
[node-pty]: https://github.com/Tyriar/node-pty
[WebDriverAgent]: https://github.com/appium/WebDriverAgent

[MSE]: https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API
[isTypeSupported]: https://developer.mozilla.org/en-US/docs/Web/API/MediaSource/isTypeSupported
[MediaSource]: https://developer.mozilla.org/en-US/docs/Web/API/MediaSource
[wasm]: https://developer.mozilla.org/en-US/docs/WebAssembly
[webgl]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
[workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { TypedEmitter } from '../../../common/TypedEmitter';
// import * as portfinder from 'portfinder'; // TODO: HBsmith
import { Server, XCUITestDriver } from '../../../types/WdaServer';
import * as XCUITest from 'appium-xcuitest-driver';
import { WDAMethod } from '../../../common/WDAMethod';
// import { timing } from '../../../workarounds/appium-support'; // TODO: HBsmith
import { WdaStatus } from '../../../common/WdaStatus';
// TODO: HBsmith
import { Config } from '../../Config';
import { Logger, Utils } from '../../Utils';
import axios from 'axios';
import * as Sentry from '@sentry/node';
//

const MJPEG_SERVER_PORT = 9100;

export interface WdaRunnerEvents {
    'status-change': { status: WdaStatus; text?: string; code?: number; detail?: string; error?: string };
    error: Error;
}

export class WdaRunner extends TypedEmitter<WdaRunnerEvents> {
    protected static TAG = 'WDARunner';
    private static instances: Map<string, WdaRunner> = new Map();
    public static SHUTDOWN_TIMEOUT = 3000; // TODO: HBsmith
    private static servers: Map<string, Server> = new Map();
    private static cachedScreenWidth: Map<string, any> = new Map();
    // TODO: HBsmith
    private static serverPorts: Map<string, number> = new Map();

    private appKey: string;
    private logger: Logger;

    private wdaEvents: Array<unknown>;
    private wdaEventInAction: boolean;
    private wdaEventTimer: NodeJS.Timeout | undefined;
    private wdaProcessId: number | undefined;
    private wdaProcessTimer: NodeJS.Timeout | undefined;
    //

    public static getInstance(udid: string): WdaRunner {
        let instance = this.instances.get(udid);
        if (!instance) {
            instance = new WdaRunner(udid);
            this.instances.set(udid, instance);
        }
        instance.lock();
        return instance;
    }

    public static async getServer(udid: string): Promise<Server> {
        let server = this.servers.get(udid);
        if (!server) {
            // TODO: HBsmith
            for (let ii = 0; ii < 2; ++ii) {
                try {
                    const port = await Utils.getPortWithLock(ii > 0);
                    server = await XCUITest.startServer(port, '127.0.0.1');

                    server.on('error', (...args: unknown[]) => {
                        console.error('Server Error:', args);
                    });
                    server.on('close', (...args: unknown[]) => {
                        console.info('Server Close:', args);
                    });
                    this.servers.set(udid, server);
                    this.serverPorts.set(udid, port);
                    break;
                } catch (e) {
                    console.error(`[${Utils.getTimeISOString()}] Failed to create XCUITest server: ${udid} / ${ii}`, e);
                    if (ii >= 1) {
                        throw e;
                    }
                }
            }
            //
        }
        // TODO: HBsmith
        if (!server) {
            throw Error(`Failed to create XCUITest server: ${udid}`);
        }
        //
        return server;
    }

    public static async getScreenWidth(udid: string, driver: XCUITestDriver): Promise<number> {
        const cached = this.cachedScreenWidth.get(udid);
        if (cached) {
            return cached;
        }
        const info = await driver.getScreenInfo();
        if (info && info.statusBarSize.width > 0) {
            const screenWidth = info.statusBarSize.width;
            this.cachedScreenWidth.set(udid, screenWidth);
            return screenWidth;
        }
        const el = await driver.findElement('xpath', '//XCUIElementTypeApplication');
        const size = await driver.getSize(el);
        if (size) {
            const screenWidth = size.width;
            this.cachedScreenWidth.set(udid, screenWidth);
            return screenWidth;
        }
        return 0;
    }

    protected name: string;
    protected started = false;
    protected starting = false;
    private server?: Server;
    private mjpegServerPort = 0;
    private wdaLocalPort = 0;
    // TODO: HBsmith
    private deviceName: string | undefined = '';
    // private holders = 0;
    //
    protected releaseTimeoutId?: NodeJS.Timeout;

    constructor(private readonly udid: string) {
        super();
        this.name = `[${WdaRunner.TAG}][udid: ${this.udid}]`;
        // TODO: HBsmith
        this.appKey = '';
        this.logger = new Logger(udid, 'iOS');
        this.wdaEvents = [];
        this.wdaProcessId = undefined;
        this.wdaProcessTimer = undefined;
        this.wdaEventInAction = false;
        this.wdaEventTimer = undefined;
        //
    }

    protected lock(): void {
        /* TODO: HBsmith
        if (this.releaseTimeoutId) {
            clearTimeout(this.releaseTimeoutId);
        }
        this.holders++;
        */
    }

    protected unlock(): void {
        /* TODO: HBsmith
        this.holders--;
        if (this.holders > 0) {
            return;
        }*/
        this.releaseTimeoutId = setTimeout(async () => {
            WdaRunner.servers.delete(this.udid);
            WdaRunner.instances.delete(this.udid);
            if (this.server) {
                if (this.server.driver) {
                    try {
                        await this.server.driver.deleteSession();
                        this.server.close();
                    } catch (e) {
                        this.logger.error(e);
                        Sentry.captureException(e, (scope) => {
                            scope.setTag('ramiel_device_type', 'iOS');
                            scope.setTag('ramiel_device_id', this.udid);
                            scope.setTag('ramiel_message', e.ramiel_message);
                            scope.setExtra('ramiel_stack', e.stack);
                            return scope;
                        });
                    }
                }
                delete this.server;
            }
            // TODO: HBsmith
            const serverPort = WdaRunner.serverPorts.get(this.udid);
            WdaRunner.serverPorts.delete(this.udid);

            let occupiedPorts = [serverPort, this.wdaLocalPort, this.mjpegServerPort];
            occupiedPorts = occupiedPorts.filter((vv, ii, aa) => aa.indexOf(vv) === ii);
            for (const port of occupiedPorts) {
                try {
                    if (!port || port <= 0) {
                        continue;
                    }
                    Utils.fileUnlock(`${port}.lock`);
                } catch (e) {
                    this.logger.error(`Failed to delete lock file: ${port}`, e);
                }
            }
            //
        }, WdaRunner.SHUTDOWN_TIMEOUT);
    }

    public get mjpegPort(): number {
        return this.mjpegServerPort;
    }

    public async request(command: ControlCenterCommand): Promise<any> {
        const driver = this.server?.driver;
        if (!driver) {
            return;
        }

        const method = command.getMethod();
        const args = command.getArgs();
        switch (method) {
            case WDAMethod.GET_SCREEN_WIDTH:
                return WdaRunner.getScreenWidth(this.udid, driver);
            case WDAMethod.CLICK:
                const { x, y } = args;
                this.wdaEvents.push((driver: XCUITestDriver) => {
                    this.logger.info(`[WDA EVENT] CLICK - x:${x}, y:${y}`);
                    return driver.performTouch([{ action: 'tap', options: { x, y } }]);
                });
                return;
            case WDAMethod.PRESS_BUTTON:
                const name = args.name;
                this.wdaEvents.push((driver: XCUITestDriver) => {
                    this.logger.info(`[WDA EVENT] PRESS_BUTTON: ${name}`);
                    return driver.mobilePressButton({ name: name });
                });
                return;
            case WDAMethod.SCROLL:
                const { from, to, holdAtStart } = args;
                this.wdaEvents.push((driver: XCUITestDriver) => {
                    this.logger.info(
                        `[WDA EVENT] SCROLL: from(${from.x}, ${from.y}), to(${to.x}, ${to.y}), ${holdAtStart}`,
                    );
                    if (holdAtStart) {
                        return driver.mobileDragFromToForDuration({
                            duration: 0.5,
                            fromX: from.x,
                            fromY: from.y,
                            toX: to.x,
                            toY: to.y,
                        });
                    }
                    return driver.performTouch([
                        { action: 'press', options: { x: from.x, y: from.y } },
                        { action: 'wait', options: { ms: 500 } },
                        { action: 'moveTo', options: { x: to.x, y: to.y } },
                        { action: 'release', options: {} },
                    ]);
                });
                return;
            case WDAMethod.APPIUM_SETTINGS:
                return driver.updateSettings(args.options);
            case WDAMethod.SEND_KEYS:
                const keys = args.keys;
                this.wdaEvents.push((driver: XCUITestDriver) => {
                    this.logger.info(`[WDA EVENT] SEND_KEYS - ${keys}`);
                    return driver.keys(keys);
                });
                return;
            // TODO: HBsmith
            case WDAMethod.LOCK:
                this.wdaEvents.push((driver: XCUITestDriver) => {
                    this.logger.info('[WDA EVENT] LOCK');
                    return driver.lock();
                });
                return;
            case WDAMethod.UNLOCK:
                this.wdaEvents.push((driver: XCUITestDriver) => {
                    this.logger.info('[WDA EVENT] UNLOCK');
                    return driver.unlock();
                });
                return;
            case WDAMethod.TERMINATE_APP:
                return driver.mobileGetActiveAppInfo().then((appInfo) => {
                    const bundleId = appInfo['bundleId'];
                    if (bundleId === 'com.apple.springboard') {
                        return;
                    }
                    this.wdaEvents.push((driver: XCUITestDriver) => {
                        this.logger.info(`[WDA EVENT] TERMINATE_APP - bundleId:${bundleId}`);
                        return driver.terminateApp(bundleId);
                    });
                    return;
                });
            case WDAMethod.TAP_LONG:
                this.wdaEvents.push((driver: XCUITestDriver) => {
                    args.duration = 1.0;
                    this.logger.info(`[WDA EVENT] TAP_LONG - x:${args.x}, y:${args.y}, duration:${args.duration}`);
                    return driver.mobileTouchAndHold(args);
                });
                return;
            case WDAMethod.REBOOT:
                Utils.rebootIOSDevice(this.udid);
                return;
            //
            default:
                return `Unknown command: ${method}`;
        }
    }

    public async start(): Promise<void> {
        if (this.started || this.starting) {
            return;
        }
        this.emit('status-change', { status: WdaStatus.STARTING });
        this.starting = true;

        let server;
        try {
            // TODO: HBsmith
            server = await WdaRunner.getServer(this.udid);
            const pid = await Utils.getProcessId(`xcodebuild.+${this.udid}`);
            if (!pid) {
                // noinspection ExceptionCaughtLocallyJS
                throw Error('No WebDriverAgent process found');
            }

            const data = await WdaRunner.apiGetDevice(this.udid);
            const webDriverAgentUrl = `http://${data['device_host']}:${data['device_port']}`;
            const remoteMjpegServerPort = MJPEG_SERVER_PORT;
            const platformVersion = data['os_version'] || '0.0';
            this.deviceName = data['alias'] || data['model'];

            for (let ii = 0; ii < 2; ++ii) {
                try {
                    const proxyPort = await Utils.getPortWithLock(ii > 0);
                    this.wdaLocalPort = proxyPort;
                    this.mjpegServerPort = proxyPort;
                    await server.driver.createSession({
                        platformName: 'iOS',
                        platformVersion: platformVersion, // TODO: HBsmith
                        deviceName: this.deviceName, // TODO: HBsmith
                        udid: this.udid,
                        wdaLocalPort: this.wdaLocalPort,
                        usePrebuiltWDA: true,
                        mjpegServerPort: remoteMjpegServerPort,
                        webDriverAgentUrl: webDriverAgentUrl, // TODO: HBsmith
                    });
                    break;
                } catch (e) {
                    this.logger.error(`Failed to create XCUITest server: ${this.udid} / ${ii}`, e);
                    if (ii >= 1) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw e;
                    }
                }
            }
            //

            /// #if USE_WDA_MJPEG_SERVER
            const { DEVICE_CONNECTIONS_FACTORY } = await import(
                'appium-xcuitest-driver/build/lib/device-connections-factory'
            );
            await DEVICE_CONNECTIONS_FACTORY.requestConnection(this.udid, this.mjpegServerPort, {
                usePortForwarding: true,
                devicePort: remoteMjpegServerPort,
            });
            /// #endif
            this.started = true;
            this.emit('status-change', { status: WdaStatus.STARTED });
        } catch (e) {
            this.started = false;
            this.starting = false;
            this.emit('error', e);
        }
        this.server = server;
    }

    public isStarted(): boolean {
        return this.started;
    }

    public release(): void {
        this.unlock();
    }

    // TODO: HBsmith
    private static async apiGetDevice(udid: string) {
        const host = Config.getInstance().getRamielApiServerEndpoint();
        const api = `/real-devices/${udid}/`;
        const hh = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf8' };
        const tt = Utils.getTimestamp();
        const pp = {
            GET: api,
            timestamp: tt,
        };
        const data = {
            GET: api,
            timestamp: tt,
            signature: Utils.getSignature(pp),
        };
        const url = `${host}${api}`;

        try {
            const rr = await axios.get(url, {
                headers: hh,
                params: data,
            });
            return rr.data;
        } catch (e) {
            let msg;
            if (e.response) {
                msg = `[${WdaRunner.TAG}] Cannot retrieve the device ${udid}. resp code: ${e.response.status}`;
            } else if (e.request) {
                msg = `[${WdaRunner.TAG}] api server is not responding.`;
            } else {
                msg = `[${WdaRunner.TAG}] ${e.message}`;
            }
            console.error(Utils.getTimeISOString(), udid, msg);
            throw e;
        }
    }

    public async setUpTest(appKey: string): Promise<void> {
        this.emit('status-change', { status: WdaStatus.SET_UP_DEVICE_INFO, text: this.deviceName });
        this.emit('status-change', { status: WdaStatus.SET_UP_GIT_INFO, text: Utils.getGitInfo() });
        this.emit('status-change', { status: WdaStatus.SET_UP, text: '장비 초기화 중' });

        this.appKey = appKey;
        this.wdaEventInAction = true;

        if (!this.server) {
            throw Error('No Server at setUpTest');
        }

        this.logger.info('setUpTest: Unlock the device');
        await this.server.driver.unlock();

        this.logger.info('setUpTest: Get the activated app');
        const appInfo = await this.server.driver.mobileGetActiveAppInfo();
        const bundleId = appInfo['bundleId'];
        if (bundleId !== 'com.apple.springboard') {
            this.logger.info(`setUpTest: Terminate the app ${bundleId}`);
            await this.server.driver.terminateApp(bundleId);
        }

        this.logger.info('setUpTest: Press the home button to go to the home screen');
        await this.server.driver.mobilePressButton({ name: 'home' });
        await this.server.driver.mobilePressButton({ name: 'home' });

        if (this.appKey) {
            this.logger.info(`setUpTest: Check the app is installed - ${this.appKey}`);
            const installed = await this.server.driver.isAppInstalled(this.appKey);
            if (installed) {
                this.logger.info(`setUpTest: Launch the terminated app to prevent Enqueue Failure - ${this.appKey}`);
                await this.server.driver.mobileLaunchApp({ bundleId: this.appKey });
                this.logger.info(`setUpTest: Terminate the app - ${this.appKey}`);
                await this.server.driver.terminateApp(this.appKey);

                this.emit('status-change', { status: WdaStatus.SET_UP_SCREEN_ON, text: '장비 초기화 중 - 앱 시작' });

                this.logger.info(`setUpTest: Launch the app - ${this.appKey}`);
                await this.server.driver.mobileLaunchApp({ bundleId: this.appKey });
                this.logger.info(`setUpTest: Activate the app - ${this.appKey}`);
                await this.server.driver.activateApp(this.appKey);
            }
        }

        this.logger.info('setUpTest: Enable the WDA events');
        this.wdaEventInAction = false;
        this.wdaEventTimer = setInterval(async () => {
            if (this.wdaEventInAction || this.wdaEvents.length === 0) {
                return;
            }

            const driver = this.server?.driver;
            if (!driver) {
                return;
            }
            const ev = this.wdaEvents.shift();
            if (!ev) {
                return;
            }
            this.wdaEventInAction = true;
            this.emit('status-change', { status: WdaStatus.IN_ACTION, text: '제어 중' });

            for (let ii = 0; ii < 3; ii++) {
                // eslint-disable-next-line @typescript-eslint/ban-types
                try {
                    // eslint-disable-next-line @typescript-eslint/ban-types
                    await (<Function>ev)(driver);
                    this.emit('status-change', { status: WdaStatus.END_ACTION, text: '제어 완료' });
                    break;
                } catch (e) {
                    if (
                        typeof e.stack === 'string' &&
                        e.stack.includes(
                            'Invalid parameter not satisfying: point.x != INFINITY && point.y != INFINITY',
                        ) &&
                        ii < 2
                    ) {
                        this.logger.info(`[WdaEventTimer] Retry the event ${ii + 1}/3: ${e.message}`);
                        await Utils.sleep(500);
                        continue;
                    }

                    this.logger.error(e);
                    this.emit('status-change', {
                        status: WdaStatus.END_ACTION,
                        text: '제어 실패',
                        error: e.stack || e.message || e,
                    });
                    break;
                }
            }

            this.wdaEventInAction = false;
        }, 100);
        this.wdaProcessId = await Utils.getProcessId(`xcodebuild.+${this.udid}`);
        if (!this.wdaProcessId) {
            throw Error('No WebDriverAgent process found');
        }

        this.wdaProcessTimer = setInterval(() => {
            if (!this.started && !this.starting) {
                return;
            }

            Utils.getProcessId(`xcodebuild.+${this.udid}`).then(async (pid) => {
                if (this.wdaProcessId && pid && this.wdaProcessId === pid) {
                    return;
                }

                this.started = false;
                this.starting = false;

                const mm = 'WebDriverAgent process has been disconnected';
                this.emit('status-change', {
                    status: WdaStatus.STOPPED,
                    code: -1,
                    text: mm,
                });
                Sentry.captureException(new Error(mm), (scope) => {
                    scope.setTag('ramiel_device_type', 'iOS');
                    scope.setTag('ramiel_device_id', this.udid);
                    scope.setTag('ramiel_message', mm);
                    return scope;
                });
            });
        }, 100);

        this.emit('status-change', { status: WdaStatus.END_SET_UP, text: '장비 초기화 완료' });
    }

    public async tearDownTest(): Promise<void> {
        this.logger.info('tearDownTest: Disable the WDA events');
        this.wdaEventInAction = false;
        this.wdaEvents = [];
        if (this.wdaEventTimer) {
            clearInterval(this.wdaEventTimer);
            this.wdaEventTimer = undefined;
        }
        if (this.wdaProcessTimer) {
            clearInterval(this.wdaProcessTimer);
            this.wdaProcessTimer = undefined;
        }

        if (!this.server) {
            throw Error('No Server at tearDownTest');
        }

        if (this.appKey) {
            this.logger.info(`tearDownTest: Check the app is installed - ${this.appKey}`);
            const installed = await this.server.driver.isAppInstalled(this.appKey);
            if (installed) {
                this.logger.info(`tearDownTest: Terminate the app - ${this.appKey}`);
                await this.server.driver.terminateApp(this.appKey);
            }
        }

        this.logger.info('tearDownTest: Get the activated app');
        const appInfo = await this.server.driver.mobileGetActiveAppInfo();
        const bundleId = appInfo['bundleId'];
        if (bundleId !== 'com.apple.springboard') {
            this.logger.info(`tearDownTest: Terminate the activated app - ${bundleId}`);
            await this.server.driver.terminateApp(bundleId);
        }

        this.logger.info('tearDownTest: Go to the first page');
        await this.server.driver.mobilePressButton({ name: 'home' });
        this.logger.info('tearDownTest: Lock the device');
        await this.server.driver.lock();
    }

    public getDeviceName(): string | undefined {
        return this.deviceName;
    }
    //
}

import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { TypedEmitter } from '../../../common/TypedEmitter';
import * as portfinder from 'portfinder';
import { Server, XCUITestDriver } from '../../../types/WdaServer';
import * as XCUITest from 'appium-xcuitest-driver';
import { WDAMethod } from '../../../common/WDAMethod';
// TODO: DEV-14061
// import { timing } from 'appium-support';
//
import { WdaStatus } from '../../../common/WdaStatus';
// TODO: DEV-14061
import { Config } from '../../Config';
import { Logger, Utils } from '../../Utils';
import axios from 'axios';
//

const MJPEG_SERVER_PORT = 9100;

export interface WdaRunnerEvents {
    'status-change': { status: WdaStatus; text?: string; code?: number };
    error: Error;
}

export class WdaRunner extends TypedEmitter<WdaRunnerEvents> {
    protected static TAG = 'WDARunner';
    private static instances: Map<string, WdaRunner> = new Map();
    public static SHUTDOWN_TIMEOUT = 15000;
    private static servers: Map<string, Server> = new Map();
    private static cachedScreenWidth: Map<string, any> = new Map();
    // TODO: HBsmith DEV-14465
    private appKey: string;
    private logger: Logger;
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
            const port = await portfinder.getPortPromise();
            server = await XCUITest.startServer(port, '127.0.0.1');
            server.on('error', (...args: any[]) => {
                console.error('Server Error:', args);
            });
            server.on('close', (...args: any[]) => {
                console.error('Server Close:', args);
            });
            this.servers.set(udid, server);
        }
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
    private holders = 0;
    protected releaseTimeoutId?: NodeJS.Timeout;

    constructor(private readonly udid: string) {
        super();
        this.name = `[${WdaRunner.TAG}][udid: ${this.udid}]`;
        // TODO: HBsmith DEV-14465
        this.appKey = '';
        this.logger = new Logger(udid, 'iOS');
        //
    }

    protected lock(): void {
        if (this.releaseTimeoutId) {
            clearTimeout(this.releaseTimeoutId);
        }
        this.holders++;
    }

    protected unlock(): void {
        this.holders--;
        if (this.holders > 0) {
            return;
        }
        this.releaseTimeoutId = setTimeout(async () => {
            WdaRunner.servers.delete(this.udid);
            WdaRunner.instances.delete(this.udid);
            if (this.server) {
                if (this.server.driver) {
                    await this.server.driver.deleteSession();
                }
                this.server.close();
                delete this.server;
            }
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
                return driver.performTouch([{ action: 'tap', options: { x: args.x, y: args.y } }]);
            case WDAMethod.PRESS_BUTTON:
                return driver.mobilePressButton({ name: args.name });
            case WDAMethod.SCROLL:
                const { from, to } = args;
                return driver.performTouch([
                    { action: 'press', options: { x: from.x, y: from.y } },
                    { action: 'wait', options: { ms: 500 } },
                    { action: 'moveTo', options: { x: to.x, y: to.y } },
                    { action: 'release', options: {} },
                ]);
            // TODO: HBsmith DEV-14062, DEV-14620
            case WDAMethod.UNLOCK:
                return driver.unlock();
            // TODO: REMOVE SEND_TEXT
            case WDAMethod.SEND_TEXT:
                const value = args.text;
                if (!value) return;
                return driver.keys(value);
            // TODO: end of SEND_TEXT
            case WDAMethod.TERMINATE_APP:
                return driver.mobileGetActiveAppInfo().then((appInfo) => {
                    const bundleId = appInfo['bundleId'];
                    if (bundleId === 'com.apple.springboard') {
                        return true;
                    }
                    return driver.terminateApp(bundleId);
                });
            case WDAMethod.APPIUM_SETTINGS:
                return driver.updateSettings(args.options);
            case WDAMethod.SEND_KEYS:
                return driver.keys(args.keys);
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
        const server = await WdaRunner.getServer(this.udid);

        try {
            // TODO: DEV-14061
            const data = await WdaRunner.apiGetDevice(this.udid);
            const webDriverAgentUrl = `http://${data['device_host']}:${data['device_port']}`;
            //
            const remoteMjpegServerPort = MJPEG_SERVER_PORT;
            const ports = await Promise.all([portfinder.getPortPromise(), portfinder.getPortPromise()]);
            this.wdaLocalPort = ports[0];
            this.mjpegServerPort = ports[1];
            await server.driver.createSession({
                platformName: 'iOS',
                deviceName: 'my iphone',
                udid: this.udid,
                wdaLocalPort: this.wdaLocalPort,
                usePrebuiltWDA: true,
                mjpegServerPort: remoteMjpegServerPort,
                webDriverAgentUrl: webDriverAgentUrl,
            });
            /* TODO: DEV-14061
            await server.driver.wda.xcodebuild.waitForStart(new timing.Timer().start());
            if (server.driver?.wda?.xcodebuild?.xcodebuild) {
                server.driver.wda.xcodebuild.xcodebuild.on('exit', (code: number) => {
                    this.started = false;
                    this.starting = false;
                    server.driver.deleteSession();
                    delete this.server;
                    this.emit('status-change', { status: WdaStatus.STOPPED, code });
                    if (this.holders > 0) {
                        this.start();
                    }
                });
            } else {
                this.started = false;
                this.starting = false;
                delete this.server;
                throw new Error('xcodebuild process not found');
            }
            */
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

    // TODO: HBsmith DEV-14061, DEV-14062
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
            signature: Utils.getSignature(pp, tt),
        };
        const url = `${host}${api}`;

        try {
            const rr = await axios.get(url, {
                headers: hh,
                params: data,
            });
            return rr.data;
        } catch (error) {
            console.error(
                Utils.getTimeISOString(),
                udid,
                `[${WdaRunner.TAG}]`,
                `Cannot retrieve the device ${udid}. resp code: ${error.response.status}`,
            );
            throw error;
        }
    }

    public async setUpTest(appKey: string): Promise<void> {
        if (!this.server) {
            this.logger.error('No Server at setUpTest', this.udid);
            return;
        }

        await this.server.driver.mobilePressButton({ name: 'home' });
        await this.server.driver.mobilePressButton({ name: 'home' });
        await this.server.driver.mobilePressButton({ name: 'home' });

        const appInfo = await this.server.driver.mobileGetActiveAppInfo();
        const bundleId = appInfo['bundleId'];
        if (bundleId !== 'com.apple.springboard') {
            await this.server.driver.terminateApp(bundleId);
        }

        if (!appKey) return;
        this.appKey = appKey;

        const installed = await this.server.driver.isAppInstalled(appKey);
        if (!installed) return;

        await this.server.driver.terminateApp(appKey);
        await this.server.driver.mobileLaunchApp({ bundleId: appKey });
        await this.server.driver.activateApp(appKey);
    }

    public async tearDownTest(): Promise<void> {
        if (!this.server) {
            this.logger.error('No Server at tearDownTest', this.udid);
            return;
        }

        if (this.appKey) {
            const installed = await this.server.driver.isAppInstalled(this.appKey);
            if (installed) {
                await this.server.driver.terminateApp(this.appKey);
            }
        }

        const appInfo = await this.server.driver.mobileGetActiveAppInfo();
        const bundleId = appInfo['bundleId'];
        if (bundleId !== 'com.apple.springboard') {
            await this.server.driver.terminateApp(bundleId);
        }

        await this.server.driver.mobilePressButton({ name: 'home' });
        await this.server.driver.lock();
    }
    //
}

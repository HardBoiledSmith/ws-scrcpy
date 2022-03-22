import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { TypedEmitter } from '../../../common/TypedEmitter';
import * as portfinder from 'portfinder';
import { Server, XCUITestDriver } from '../../../types/WdaServer';
import * as XCUITest from 'appium-xcuitest-driver';
import { DEVICE_CONNECTIONS_FACTORY } from 'appium-xcuitest-driver/build/lib/device-connections-factory';
import { WDAMethod } from '../../../common/WDAMethod';
// TODO: DEV-14061
// import { timing } from 'appium-support';
//
import { WdaStatus } from '../../../common/WdaStatus';
// TODO: DEV-14061
import { Config } from '../../Config';
import { Utils } from '../../Utils';
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
    //
    private appKey: string;

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
        //
        this.appKey = '';
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
            case WDAMethod.SEND_TEXT:
                const value = args.text;
                if (!value) return;
                return driver.keys(value);
            case WDAMethod.TERMINATE_APP:
                const bundleId = args.bundleId;
                if (!bundleId) return;
                return driver.isAppInstalled(bundleId).then(() => {
                    return driver.terminateApp(bundleId);
                });
            //
            default:
                return `Unknown command: ${method}`;
        }
    }

    public async start(): Promise<void> {
        if (this.started || this.starting) {
            return;
        }
        this.emit('status-change', { status: 'starting' });
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
                    this.emit('status-change', { status: 'stopped', code });
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
            /// #if WDA_RUN_MJPEG_SERVER
            await DEVICE_CONNECTIONS_FACTORY.requestConnection(this.udid, this.mjpegServerPort, {
                usePortForwarding: true,
                devicePort: remoteMjpegServerPort,
            });
            /// #endif
            this.started = true;
            this.emit('status-change', { status: 'started' });
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
                `[${WdaRunner.TAG}]`,
                `Cannot retrieve the device ${udid}. resp code: ${error.response.status}`,
            );
            throw error;
        }
    }

    public async setUpTest(appKey: string): Promise<void> {
        if (!this.server) {
            console.error(Utils.getTimeISOString(), 'No Server at setUpTest', this.udid);
            return;
        }

        await this.server.driver.mobilePressButton({ name: 'home' });
        await this.server.driver.mobilePressButton({ name: 'home' });
        await this.server.driver.mobilePressButton({ name: 'home' });

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
            console.error(Utils.getTimeISOString(), 'No Server at tearDownTest', this.udid);
            return;
        }

        if (this.appKey) {
            const installed = await this.server.driver.isAppInstalled(this.appKey);
            if (installed) {
                await this.server.driver.terminateApp(this.appKey);
            }
        }

        await this.server.driver.mobilePressButton({ name: 'home' });
        await this.server.driver.lock();
    }
    //
}

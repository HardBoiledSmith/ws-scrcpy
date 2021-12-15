import { WebsocketProxy } from '../../mw/WebsocketProxy';
import { AdbUtils } from '../AdbUtils';
import WS from 'ws';
import { RequestParameters } from '../../mw/Mw';
import { ACTION } from '../../../common/Action';

// TODO: HBsmith DEV-12386
import { Device } from '../Device';
//
// TODO: HBsmith DEV-12387
import { Config } from '../../Config';
import { Utils } from '../../Utils';
import axios from 'axios';
//
// TODO: DEV-12826, DEV-13493
import qs from 'qs';
import KeyEvent from '../../../app/googDevice/android/KeyEvent';
//

export class WebsocketProxyOverAdb extends WebsocketProxy {
    // TODO: HBsmith DEV-12386
    private udid = '';
    private appKey = '';
    //
    // TODO: HBsmith DEV-12386
    private apiSessionCreated = false;
    //

    public static processRequest(ws: WS, params: RequestParameters): WebsocketProxy | undefined {
        const { parsedQuery, parsedUrl } = params;
        let udid: string | string[] = '';
        let remote: string | string[] = '';
        let path: string | string[] = '';
        let isSuitable = false;
        if (parsedQuery?.action === ACTION.PROXY_ADB) {
            isSuitable = true;
            remote = parsedQuery.remote;
            udid = parsedQuery.udid;
            path = parsedQuery.path;
        }
        if (parsedUrl && parsedUrl.path) {
            const temp = parsedUrl.path.split('/');
            // Shortcut for action=proxy, without query string
            if (temp.length >= 4 && temp[0] === '' && temp[1] === ACTION.PROXY_ADB) {
                isSuitable = true;
                temp.splice(0, 2);
                udid = decodeURIComponent(temp.shift() || '');
                remote = decodeURIComponent(temp.shift() || '');
                path = temp.join('/') || '/';
            }
        }
        if (!isSuitable) {
            return;
        }
        if (typeof remote !== 'string' || !remote) {
            ws.close(4003, `[${this.TAG}] Invalid value "${remote}" for "remote" parameter`);
            return;
        }
        if (typeof udid !== 'string' || !udid) {
            ws.close(4003, `[${this.TAG}] Invalid value "${udid}" for "udid" parameter`);
            return;
        }
        if (path && typeof path !== 'string') {
            ws.close(4003, `[${this.TAG}] Invalid value "${path}" for "path" parameter`);
            return;
        }
        // TODO: HBsmith DEV-12386
        let appKey = '';
        if (parsedQuery?.app_key !== null && parsedQuery?.app_key !== undefined) {
            appKey = parsedQuery['app_key'].toString();
        }
        // TODO: HBsmith DEV-12386
        return this.createProxyOverAdb(ws, udid, remote, path, appKey);
        //
    }

    // TODO: HBsmith DEV-12387, DEV-12826, DEV-13214
    private static async apiCreateSession(ws: WS, udid: string) {
        const host = Config.getInstance().getRamielApiServerEndpoint();
        const api = `/real-devices/${udid}/control/`;
        const hh = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf8' };
        const tt = Utils.getTimestamp();
        const pp = {
            POST: api,
            timestamp: tt,
        };
        const data = qs.stringify({
            POST: api,
            timestamp: tt,
            signature: Utils.getSignature(pp, tt),
        });
        const url = `${host}${api}`;
        const tag = WebsocketProxyOverAdb.TAG;

        await axios
            .post(url, data, {
                headers: hh,
            })
            .then((rr) => {
                console.log(`[${tag}] success to create session. resp code: ${rr.status}`);
                return rr.status;
            })
            .catch((error) => {
                console.error(`[${tag}] failed to create a session. resp code: ${error.response.status}`);
                let msg = `[${this.TAG}] failed to create a session for ${udid}`;
                if (!('response' in error)) msg = msg = `undefined response in error`;
                else if (409 == error.response.status) msg = `사용 중인 장비입니다`;
                else if (503 == error.response.status) msg = `장비의 연결이 끊어져있습니다`;
                ws.close(4900, msg);
                throw error;
            });
    }

    private apiDeleteSession(udid: string) {
        const host = Config.getInstance().getRamielApiServerEndpoint();
        const api = `/real-devices/${udid}/control/`;
        const hh = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf8' };
        const tt = Utils.getTimestamp();
        const pp = {
            DELETE: api,
            timestamp: tt,
        };
        const data = qs.stringify({
            DELETE: api,
            timestamp: tt,
            signature: Utils.getSignature(pp, tt),
        });
        const url = `${host}${api}`;
        const tag = WebsocketProxyOverAdb.TAG;

        axios
            .delete(url, {
                headers: hh,
                data: data,
            })
            .then((rr) => {
                console.log(`[${tag}] success to delete a session. resp code: ${rr.status}`);
            })
            .catch((error) => {
                console.error(`[${tag}] failed to delete a session. resp code: ${error.response.status}`);
            });
    }
    //

    public static createProxyOverAdb(
        ws: WS,
        udid: string,
        remote: string,
        path?: string,
        appKey?: string, // TODO: HBsmith DEV-12386, DEV-13531
    ): WebsocketProxyOverAdb {
        // TODO: HBsmith DEV-12387, DEV-13521
        const service = new WebsocketProxyOverAdb(ws);
        this.apiCreateSession(ws, udid)
            .then(() => {
                AdbUtils.forward(udid, remote)
                    .then((port) => {
                        return service.init(`ws://127.0.0.1:${port}${path ? path : ''}`);
                    })
                    .catch((e) => {
                        const msg = `[${this.TAG}] Failed to start service: ${e.message}`;
                        console.error(msg);
                        ws.close(4005, msg);
                    });
                service.setUpTest(udid, appKey);
            })
            .catch(() => {
                // console.error(e);
            });
        //
        return service;
    }

    // TODO: HBsmith DEV-12386, DEV-13493
    public release(): void {
        this.tearDownTest();
        super.release();
    }

    private getDevice(): Device | null {
        if (!this.udid) {
            return null;
        }
        return new Device(this.udid, 'device');
    }

    private setUpTest(udid: string, appKey?: string): void {
        this.apiSessionCreated = true;
        if (udid) {
            this.udid = udid;
        }
        if (appKey) {
            this.appKey = appKey;
        }

        const device = this.getDevice();
        if (!device) {
            return;
        }
        // send key event code 82 many times for deterministic unlock
        const cmdMenu = `input keyevent ${KeyEvent.KEYCODE_MENU}`;
        const cmdHome = `input keyevent ${KeyEvent.KEYCODE_HOME}`;
        device
            .runShellCommandAdbKit(cmdMenu)
            .then((output) => {
                console.log(output ? output : `success to send 1st KEYCODE_MENU: ${cmdMenu}`);
                return device.runShellCommandAdbKit(cmdMenu);
            })
            .then((output) => {
                console.log(output ? output : `success to send 2nd KEYCODE_MENU: ${cmdMenu}`);
                return device.runShellCommandAdbKit(cmdMenu);
            })
            .then((output) => {
                console.log(output ? output : `success to send 3rd KEYCODE_MENU: ${cmdMenu}`);
                return device.runShellCommandAdbKit(cmdHome);
            })
            .then((output) => {
                console.log(output ? output : `success to send KEYCODE_HOME: ${cmdHome}`);

                if (!this.appKey) {
                    return;
                }

                const cmdAppStop = `am force-stop '${this.appKey}'`;
                const cmdAppStart = `monkey -p '${this.appKey}' -c android.intent.category.LAUNCHER 1`;

                device
                    .runShellCommandAdbKit(cmdAppStop)
                    .then((output) => {
                        console.log(output ? output : `success to stop the app: ${cmdAppStop}`);
                        return device.runShellCommandAdbKit(cmdAppStart);
                    })
                    .then((output) => {
                        console.log(output ? output : `success to start the app: ${cmdAppStart}`);
                    })
                    .catch((e) => {
                        console.error(e);
                    });
            })
            .catch((e) => {
                console.error(e);
            });
    }

    private tearDownTest(): void {
        if (!this.apiSessionCreated || !this.udid) {
            return;
        }

        const device = this.getDevice();
        if (device) {
            const cmdPower = `input keyevent ${KeyEvent.KEYCODE_POWER}`;
            device
                .runShellCommandAdbKit(cmdPower)
                .then((output) => {
                    console.log(output ? output : `success to run a command: ${cmdPower}`);

                    if (!this.appKey) {
                        return;
                    }

                    const cmdStopApp = `am force-stop '${this.appKey}'`;
                    device
                        .runShellCommandAdbKit(cmdStopApp)
                        .then((output) => {
                            console.log(output ? output : `success to stop app: ${cmdStopApp}`);
                        })
                        .catch((e) => {
                            console.error(e);
                        });
                })
                .catch((e) => {
                    console.error(e);
                });
        }

        this.apiDeleteSession(this.udid);
    }
    //
}

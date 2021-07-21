import { WebsocketProxy } from '../../mw/WebsocketProxy';
import { AdbUtils } from '../AdbUtils';
import WebSocket from 'ws';
import { RequestParameters } from '../../mw/Mw';
import { ACTION } from '../../../common/Action';

// TODO: HBsmith DEV-12386
import { Device } from '../Device';
//

export class WebsocketProxyOverAdb extends WebsocketProxy {
    public static processRequest(ws: WebSocket, params: RequestParameters): WebsocketProxy | undefined {
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
        if (parsedQuery?.app_key !== null && parsedQuery?.app_key !== undefined) {
            const appKey = parsedQuery['app_key'].toString();
            const device = new Device(udid.toString(), 'device');
            // send key event code 82 twice for deterministic unlock
            device.runShellCommandAdbKit('82').then((output) => {
                console.log(output);
            });
            device.runShellCommandAdbKit('82').then((output) => {
                console.log(output);
            });
            device.runShellCommandAdbKit(`am force-stop '${appKey}'`).then((output) => {
                console.log(output);
            });
            device
                .runShellCommandAdbKit(`monkey -p '${appKey}' -c android.intent.category.LAUNCHER 1`)
                .then((output) => {
                    console.log(output);
                });
        }
        //
        return this.createProxyOverAdb(ws, udid, remote, path);
    }

    public static createProxyOverAdb(ws: WebSocket, udid: string, remote: string, path?: string): WebsocketProxy {
        const service = new WebsocketProxy(ws);
        AdbUtils.forward(udid, remote)
            .then((port) => {
                return service.init(`ws://127.0.0.1:${port}${path ? path : ''}`);
            })
            .catch((e) => {
                const msg = `[${this.TAG}] Failed to start service: ${e.message}`;
                console.error(msg);
                ws.close(4005, msg);
            });
        return service;
    }

    // HBsmith DEV-12386
    public release(): void {
        // TODO: app terminate & lock
        // TODO: retrieve udid and appKey
        super.release();
    }
}

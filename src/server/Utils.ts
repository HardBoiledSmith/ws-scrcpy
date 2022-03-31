import * as os from 'os';
import qs from 'qs';
import { createHmac } from 'crypto';

export class Utils {
    public static printListeningMsg(proto: string, port: number): void {
        const ipv4List: string[] = [];
        const ipv6List: string[] = [];
        const formatAddress = (ip: string, scopeid: number | undefined): void => {
            if (typeof scopeid === 'undefined') {
                ipv4List.push(`${proto}://${ip}:${port}`);
                return;
            }
            if (scopeid === 0) {
                ipv6List.push(`${proto}://[${ip}]:${port}`);
            } else {
                return;
                // skip
                // ipv6List.push(`${proto}://[${ip}%${scopeid}]:${port}`);
            }
        };
        Object.keys(os.networkInterfaces())
            .map((key) => os.networkInterfaces()[key])
            .forEach((info) => {
                info.forEach((iface) => {
                    let scopeid: number | undefined;
                    if (iface.family === 'IPv6') {
                        scopeid = iface.scopeid;
                    } else if (iface.family === 'IPv4') {
                        scopeid = undefined;
                    } else {
                        return;
                    }
                    formatAddress(iface.address, scopeid);
                });
            });
        const nameList = [encodeURI(`${proto}://${os.hostname()}:${port}`), encodeURI(`${proto}://localhost:${port}`)];
        console.log('Listening on:\n\t' + nameList.join(' '));
        if (ipv4List.length) {
            console.log('\t' + ipv4List.join(' '));
        }
        if (ipv6List.length) {
            console.log('\t' + ipv6List.join(' '));
        }
    }

    // TODO: HBsmith DEV-12387, DEV-12826, DEV-13468
    public static getTimestamp(): number {
        return Math.trunc(new Date().getTime() / 1000) - 5;
    }

    public static getBaseString(params: Record<string, unknown>): string {
        return qs.stringify(params);
    }

    public static getSignature(params: Record<string, unknown>, timestamp: number): string {
        const algorithm = 'sha1';
        const privateKey = timestamp.toString();
        const secretKey = privateKey + '&';
        let baseString = this.getBaseString(params);
        baseString = encodeURIComponent(baseString);
        baseString = '&&' + baseString;
        return createHmac(algorithm, secretKey).update(baseString).digest('base64');
    }
    //

    // TODO: HBsmith DEV-13549
    public static getTimeISOString(): string {
        return new Date().toISOString();
    }
    //
}

// DEV-14465
export class Logger {
    private udid: string;
    private type: string;

    constructor(udid: string, type: string) {
        this.udid = udid;
        this.type = type;
    }

    public info(...args: any[]): void {
        console.log(Utils.getTimeISOString(), this.type, this.udid, ...args);
    }

    public error(...args: any[]): void {
        console.error(Utils.getTimeISOString(), this.type, this.udid, ...args);
    }
}
//

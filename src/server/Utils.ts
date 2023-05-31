import * as os from 'os';
// TODO: HBsmith
import * as portfinder from 'portfinder';
import fs from 'fs';
import qs from 'qs';
import { createHmac } from 'crypto';
import { execSync } from 'child_process';
import gitRepoInfo from 'git-repo-info';
import { Config } from './Config';
//

export class Utils {
    private static readonly PathToFileLock: string = '/tmp/ramiel_file_lock';

    public static readonly BasePort = 38000;
    public static readonly StopPort = 40000;

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

    // TODO: HBsmith
    public static getTimestamp(): number {
        return Math.trunc(new Date().getTime() / 1000) - 5;
    }

    public static getBaseString(params: Record<string, unknown>): string {
        return qs.stringify(params);
    }

    public static getSignature(params: Record<string, unknown>): string {
        const algorithm = 'sha1';
        const privateKey = Config.getInstance().getHMACIdcKey();
        const secretKey = privateKey + '&';
        let baseString = this.getBaseString(params);
        baseString = encodeURIComponent(baseString);
        baseString = '&&' + baseString;
        return createHmac(algorithm, secretKey).update(baseString).digest('base64');
    }

    public static getTimeISOString(): string {
        return new Date().toISOString();
    }

    public static async getProcessId(query: string): Promise<number | undefined> {
        let cmd = '';
        if (['darwin', 'linux'].includes(process.platform)) {
            cmd = `ps -ef | grep -E '${query}' | grep -v grep | awk '{ print $2 }' | head -1`;
        } else {
            throw new Error('Unsupported platform');
        }

        try {
            return Number(execSync(cmd).toString().trim());
        } catch {
            return undefined;
        }
    }

    public static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private static checkExpiredFileLock(file: string): void {
        const pp = `${Utils.PathToFileLock}/${file}`;
        if (!fs.existsSync(pp)) {
            return;
        }

        const ss = fs.statSync(pp);
        if (!ss) {
            return;
        }

        const ee = Date.now() - ss.birthtimeMs - Date.now();
        if (ee < 30 * 60 * 1000) {
            return;
        }

        console.log(`Expired file lock found: ${pp}, ${ee}ms`);
        try {
            fs.unlinkSync(pp);
        } catch (e) {
            console.log(`Error while deleting expired file lock: ${pp}`);
        }
    }

    private static fileLock(file: string): void {
        const fd = fs.openSync(`${Utils.PathToFileLock}/${file}`, 'wx');
        fs.closeSync(fd);
    }

    public static fileUnlock(file: string): void {
        fs.unlinkSync(`${Utils.PathToFileLock}/${file}`);
    }

    public static async initFileLock(): Promise<void> {
        try {
            if (fs.existsSync(Utils.PathToFileLock)) {
                fs.rmdirSync(Utils.PathToFileLock, { recursive: true });
            }
            fs.mkdirSync(Utils.PathToFileLock);
        } catch (e) {
            console.log(e);
        }
    }

    private static getLastFileLock(): number {
        let ll = fs.readdirSync(Utils.PathToFileLock);
        ll = ll.filter((file) => /\d+\.lock$/.test(file));
        const aa: number[] = [];
        ll.forEach((ee) => {
            const rr = /(\d+)\.lock/.exec(ee);
            if (!rr || rr.length < 1) return;
            aa.push(parseInt(rr[1]));
        });
        const rr = Math.max(...aa);
        if (rr < Utils.BasePort || rr > Utils.StopPort) {
            return -1;
        }
        return rr;
    }

    public static async getPortWithLock(changePortRange = false): Promise<number> {
        let basePort = Utils.BasePort;
        if (changePortRange) {
            const pp = Utils.getLastFileLock();
            if (pp >= 0) {
                basePort = pp + 1;
            }
        }
        if (basePort < Utils.BasePort || basePort > Utils.StopPort) {
            throw Error(`Invalid port: ${basePort}`);
        }

        let port = -1;
        for (let i = 0; i < 3; ++i) {
            port = await portfinder.getPortPromise({
                port: basePort,
                stopPort: Utils.StopPort,
            });

            try {
                if (!port) {
                    // noinspection ExceptionCaughtLocallyJS
                    throw Error('No free port found');
                }
                const pp = `${port}.lock`;
                Utils.checkExpiredFileLock(pp);
                Utils.fileLock(pp);
                break;
            } catch (e) {
                if ('EEXIST' === e.code && i < 2) {
                    await Utils.sleep(1000 * 2 ** i);
                } else {
                    // noinspection ExceptionCaughtLocallyJS
                    throw e;
                }
            }
        }
        return port;
    }

    public static getGitInfo() {
        try {
            return gitRepoInfo().branch + '-' + gitRepoInfo().sha;
        } catch (e) {
            console.error('Failed to load Git info: ' + e.message);
            return 'Failed to load Git info: ' + e.message;
        }
    }

    public static getGitPhase(): string {
        let bb;
        try {
            bb = execSync(`cd ${__dirname} && git branch --show-current`).toString().trim();
        } catch (e) {
            return 'ErrorPhase';
        }

        if (['qa', 'op'].includes(bb)) {
            return bb;
        }
        return 'dv';
    }

    public static getAppVersion(): string {
        try {
            return execSync(`cd ${__dirname} && git rev-parse --verify HEAD`).toString().trim();
        } catch (e) {
            return 'ErrorHash';
        }
    }
    //
}

// TODO: HBsmith
export class Logger {
    private readonly udid: string;
    private readonly type: string;

    constructor(udid: string, type: string) {
        this.udid = udid;
        this.type = type;
    }

    public info(...args: unknown[]): void {
        console.log(Utils.getTimeISOString(), this.type, this.udid, ...args);
    }

    public error(...args: unknown[]): void {
        console.error(Utils.getTimeISOString(), this.type, this.udid, ...args);
    }
}
//

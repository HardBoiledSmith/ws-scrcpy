import * as http from 'http';
import * as https from 'https';
import path from 'path';
import { Service } from './Service';
import { Utils } from '../Utils';
import express, { Express } from 'express';
import { Config } from '../Config';

const DEFAULT_STATIC_DIR = path.join(__dirname, './public');

export type ServerAndPort = {
    server: https.Server | http.Server;
    port: number;
};

export class HttpServer implements Service {
    private static instance: HttpServer;
    private static PUBLIC_DIR = DEFAULT_STATIC_DIR;
    private static SERVE_STATIC = true;
    private servers: ServerAndPort[] = [];
    private mainApp?: Express;

    protected constructor() {
        // nothing here
    }

    public static getInstance(): HttpServer {
        if (!this.instance) {
            this.instance = new HttpServer();
        }
        return this.instance;
    }

    public static hasInstance(): boolean {
        return !!this.instance;
    }

    public static setPublicDir(dir: string): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.PUBLIC_DIR = dir;
    }

    public static setServeStatic(enabled: boolean): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.SERVE_STATIC = enabled;
    }

    public getServers(): ServerAndPort[] {
        return [...this.servers];
    }

    public getName(): string {
        return `HTTP(s) Server Service`;
    }

    // TODO: HBsmith DEV-11721, DEV-13549
    public CheckPermission(req: express.Request, res: express.Response, next: express.NextFunction): void {
        if (req.url === '/') {
            res.status(400).send('BAD REQUEST');
            return;
        }

        if (Object.keys(req.query).length != 0) {
            try {
                const expireTimestampIn = 300;

                const api = req.query['GET'];
                const appKey = req.query.hasOwnProperty('app_key') ? req.query['app_key'] : null;
                const timestamp = Number(req.query['timestamp']);
                const userAgent = req.query['user-agent'];
                const signature = req.query['signature'];

                const curTimestamp = Utils.getTimestamp();
                const td = curTimestamp - timestamp;
                if (td > expireTimestampIn) {
                    res.status(400).send('timestamp');
                    return;
                }

                let pp = null;
                if (appKey) {
                    pp = {
                        GET: api,
                        app_key: appKey,
                        timestamp: timestamp,
                        'user-agent': userAgent,
                    };
                } else {
                    pp = {
                        GET: api,
                        timestamp: timestamp,
                        'user-agent': userAgent,
                    };
                }
                const serverSignature = Utils.getSignature(pp, timestamp);
                if (serverSignature != signature) {
                    res.status(400).send('signature');
                    return;
                }
            } catch (e) {
                res.status(400).send('BAD REQUEST');
                return;
            }
        }

        next();
    }
    //

    public start(): void {
        this.mainApp = express();
        if (HttpServer.SERVE_STATIC && HttpServer.PUBLIC_DIR) {
            // TODO: HBsmith DEV-11721
            this.mainApp.use(this.CheckPermission);
            //
            this.mainApp.use(express.static(HttpServer.PUBLIC_DIR));
        }
        const config = Config.getInstance();
        config.getServers().forEach((serverItem) => {
            const { secure, port, redirectToSecure } = serverItem;
            let proto: string;
            let server: http.Server | https.Server;
            if (secure) {
                if (!serverItem.options) {
                    throw Error('Must provide option for secure server configuration');
                }
                let { key, cert } = serverItem.options;
                const { keyPath, certPath } = serverItem.options;
                if (!key) {
                    if (typeof keyPath !== 'string') {
                        throw Error('Must provide parameter "key" or "keyPath"');
                    }
                    key = config.readFile(keyPath);
                }
                if (!cert) {
                    if (typeof certPath !== 'string') {
                        throw Error('Must provide parameter "cert" or "certPath"');
                    }
                    cert = config.readFile(certPath);
                }
                const options = { ...serverItem.options, cert, key };
                server = https.createServer(options, this.mainApp);
                proto = 'https';
            } else {
                const options = serverItem.options ? { ...serverItem.options } : {};
                proto = 'http';
                let currentApp = this.mainApp;
                let host = '';
                let port = 443;
                let doRedirect = false;
                if (redirectToSecure === true) {
                    doRedirect = true;
                } else if (typeof redirectToSecure === 'object') {
                    doRedirect = true;
                    if (typeof redirectToSecure.port === 'number') {
                        port = redirectToSecure.port;
                    }
                    if (typeof redirectToSecure.host === 'string') {
                        host = redirectToSecure.host;
                    }
                }
                if (doRedirect) {
                    currentApp = express();
                    currentApp.use(function (req, res) {
                        const url = new URL(`https://${host ? host : req.headers.host}${req.url}`);
                        if (port && port !== 443) {
                            url.port = port.toString();
                        }
                        return res.redirect(301, url.toString());
                    });
                }
                server = http.createServer(options, currentApp);
            }
            this.servers.push({ server, port });
            server.listen(port, () => {
                Utils.printListeningMsg(proto, port);
            });
        });
    }

    public release(): void {
        this.servers.forEach((item) => {
            item.server.close();
        });
    }
}

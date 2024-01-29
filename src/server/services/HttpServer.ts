import * as http from 'http';
import * as https from 'https';
import path from 'path';
import { Service } from './Service';
import { Utils } from '../Utils';
import express, { Express } from 'express';
import { Config } from '../Config';
import { TypedEmitter } from '../../common/TypedEmitter';
// TODO: HBsmith
import * as Sentry from '@sentry/node';
import axios from 'axios';
//

const DEFAULT_STATIC_DIR = path.join(__dirname, './public');

export type ServerAndPort = {
    server: https.Server | http.Server;
    port: number;
};

interface HttpServerEvents {
    started: boolean;
}

export class HttpServer extends TypedEmitter<HttpServerEvents> implements Service {
    private static instance: HttpServer;
    private static PUBLIC_DIR = DEFAULT_STATIC_DIR;
    private static SERVE_STATIC = true;
    private servers: ServerAndPort[] = [];
    private mainApp?: Express;
    private started = false;

    protected constructor() {
        super();
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

    public async getServers(): Promise<ServerAndPort[]> {
        if (this.started) {
            return [...this.servers];
        }
        return new Promise<ServerAndPort[]>((resolve) => {
            this.once('started', () => {
                resolve([...this.servers]);
            });
        });
    }

    public getName(): string {
        return `HTTP(s) Server Service`;
    }

    // TODO: HBsmith
    public async CheckPermission(req: express.Request, res: express.Response, next: express.NextFunction) {
        if (req.hostname === 'localhost') {
            console.log(Utils.getTimeISOString(), 'Checking permission has been bypassed: host is', req.hostname);
        } else if (req.url === '/') {
            res.status(400).send('BAD REQUEST');
            return;
        } else if (Object.keys(req.query).length != 0) {
            try {
                const accessToken = req.query['access-token'];

                if (accessToken) {
                    const udid = req.query['udid'];
                    const teamName = req.query['team-name'];
                    if (!udid || !teamName) {
                        res.status(401).send('UNAUTHORIZED');
                        return;
                    }
                    try {
                        await axios.get(`${Config.getInstance().getRamielApiServerEndpoint()}/real-devices/${udid}/`, {
                            headers: { Authorization: `Bearer ${accessToken}` },
                            params: { team_name: teamName },
                        });
                    } catch (e) {
                        if (e.response) {
                            res.status(401).send('UNAUTHORIZED');
                        } else {
                            res.status(503).send('api server is not responding');
                        }
                        return;
                    }
                } else {
                    const api = req.query['GET'];
                    const appKey = req.query['app_key'];
                    const userAgent = req.query['user-agent'];
                    const udid = req.query['udid'];
                    const teamName = req.query['team-name'];
                    const timestamp = Number(req.query['timestamp']);
                    const signature = req.query['signature'];

                    if (Utils.getTimestamp() - timestamp > 300) {
                        res.status(400).send('timestamp');
                        return;
                    } else if (!udid || !teamName) {
                        res.status(400).send('BAD REQUEST');
                        return;
                    }

                    const pp = {
                        GET: api,
                        timestamp: timestamp,
                        'user-agent': userAgent,
                        udid: udid,
                        'team-name': teamName,
                        ...(appKey && { app_key: appKey }),
                    };
                    const serverSignature = Utils.getSignature(pp);
                    if (serverSignature != signature) {
                        res.status(400).send('signature');
                        return;
                    }

                    let dd;
                    const p2 = {
                        GET: api,
                        timestamp: timestamp,
                    };
                    const ss = Utils.getSignature(p2);
                    try {
                        dd = await axios.get(
                            `${Config.getInstance().getRamielApiServerEndpoint()}/real-devices/${udid}/`,
                            {
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf8' },
                                params: {
                                    GET: api,
                                    timestamp: timestamp,
                                    signature: ss,
                                },
                            },
                        );
                    } catch (e) {
                        if (e.response) {
                            res.status(401).send('UNAUTHORIZED');
                        } else {
                            res.status(503).send('api server is not responding');
                        }
                        return;
                    }

                    const ee = [dd.data.team_name, dd.data.team2_name, dd.data.team3_name].find(
                        (ii) => ii === teamName,
                    );
                    if (!ee) {
                        res.status(403).send('FORBIDDEN');
                        return;
                    }
                }
            } catch (e) {
                res.status(400).send('BAD REQUEST');
                return;
            }
        }

        next();
    }
    //

    public async start(): Promise<void> {
        // TODO: HBsmith
        await Utils.initDevices();
        await Utils.initFileLock();

        const app = express();
        if (Utils.getGitPhase() === 'op') {
            Sentry.init({
                dsn: Config.getInstance().getSentryDSN(),
                environment: Utils.getGitPhase(),
                release: `${Config.getInstance().getSentryProject()}@${Utils.getAppVersion()}`,
                integrations: [new Sentry.Integrations.Express({ app })],
            });
        }
        this.mainApp = app;
        //
        if (HttpServer.SERVE_STATIC && HttpServer.PUBLIC_DIR) {
            // TODO: HBsmith
            this.mainApp.use(this.CheckPermission);
            //
            this.mainApp.use(express.static(HttpServer.PUBLIC_DIR));

            /// #if USE_WDA_MJPEG_SERVER

            const { MjpegProxyFactory } = await import('../mw/MjpegProxyFactory');
            this.mainApp.get('/mjpeg/:udid', new MjpegProxyFactory().proxyRequest);
            /// #endif

            // TODO: HBsmith
            this.mainApp.get('/echo', (_, res) => {
                res.send();
            });
            //
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
                // TODO: HBsmith
                server.timeout = 300 * 1000;
                //
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
                // TODO: HBsmith
                server.timeout = 300 * 1000;
                //
            }
            this.servers.push({ server, port });
            server.listen(port, () => {
                Utils.printListeningMsg(proto, port);
            });
        });
        this.started = true;
        this.emit('started', true);
    }

    public release(): void {
        this.servers.forEach((item) => {
            item.server.close();
        });
    }
}

import * as http from 'http';
import path from 'path';
import { Service } from './Service';
import { Utils } from '../Utils';
import express, { Express } from 'express';

// TODO: HBsmith DEV-11721
import { createHmac } from "crypto";
import qs from 'qs';

const proto = 'http';
const DEFAULT_PORT = 28500;
const DEFAULT_STATIC_DIR = path.join(__dirname, './public');

export class HttpServer implements Service {
    private static instance: HttpServer;
    private static PORT = DEFAULT_PORT;
    private static PUBLIC_DIR = DEFAULT_STATIC_DIR;
    private static SERVE_STATIC = true;
    private server?: http.Server;
    private app?: Express;

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

    public static setPort(port: number): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.PORT = port;
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

    public getPort(): number {
        return HttpServer.PORT;
    }

    public getServer(): http.Server | undefined {
        return this.server;
    }

    public getName(): string {
        return `HTTP Server {tcp:${HttpServer.PORT}}`;
    }

    // TODO: HBsmith DEV-11721
    public CheckPermission(req: express.Request, res: express.Response, next: express.NextFunction): void {
        if (req.url === '/') {
            res.status(400).send('BAD REQUEST');
            return;
        }

        if (Object.keys(req.query).length != 0) {
            try {
                const algorithm = 'sha1';
                const privateKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
                const secretKey = privateKey + '&';
                const expireTimestampIn = 60;

                const api = req.query['GET'];
                const timestamp = Number(req.query['timestamp']);
                const signature = req.query['signature'];

                const curTimestamp = new Date().getTime() / 1000;
                const td = curTimestamp - timestamp;
                if (td > expireTimestampIn) {
                    res.status(400).send('timestamp');
                    return;
                }

                const pp = {
                    GET: api,
                    timestamp: timestamp,
                };
                let baseString = qs.stringify(pp);
                baseString = encodeURIComponent(baseString);
                baseString = '&&' + baseString;
                const serverSignature = createHmac(algorithm, secretKey).update(baseString).digest('base64');
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
        this.app = express();
        if (HttpServer.SERVE_STATIC && HttpServer.PUBLIC_DIR) {
            // TODO: HBsmith DEV-11721
            this.app.use(this.CheckPermission);
            //
            this.app.use(express.static(HttpServer.PUBLIC_DIR));
        }
        this.server = http.createServer(this.app).listen(HttpServer.PORT, () => {
            Utils.printListeningMsg(proto, HttpServer.PORT);
        });
    }

    public release(): void {
        this.server?.close();
    }
}

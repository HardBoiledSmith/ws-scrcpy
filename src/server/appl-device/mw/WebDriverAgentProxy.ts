import WS from 'ws';
import { Mw } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { WdaRunner } from '../services/WDARunner';
import { MessageRunWdaResponse } from '../../../types/MessageRunWdaResponse';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';
import Util from '../../../app/Util';
import { WdaStatus } from '../../../common/WdaStatus';
import { Config } from '../../Config';
import { Utils, Logger } from '../../Utils'; // TODO: HBsmith DEV-14465
import qs from 'qs';
import axios from 'axios';

export class WebDriverAgentProxy extends Mw {
    public static readonly TAG = 'WebDriverAgentProxy';
    protected name: string;
    private wda?: WdaRunner;
    // TODO: HBsmith DEV-14260, DEV-14465
    private appKey: string;
    private userAgent: string;
    private apiSessionCreated: boolean;
    private logger: Logger;
    //

    public static processChannel(ws: Multiplexer, code: string, data: ArrayBuffer): Mw | undefined {
        if (code !== ChannelCode.WDAP) {
            return;
        }
        if (!data || data.byteLength < 4) {
            return;
        }
        const buffer = Buffer.from(data);
        const length = buffer.readInt32LE(0);
        const udid = Util.utf8ByteArrayToString(buffer.slice(4, 4 + length));

        return new WebDriverAgentProxy(ws, udid);
    }

    constructor(protected ws: Multiplexer, private readonly udid: string) {
        super(ws);
        this.name = `[${WebDriverAgentProxy.TAG}][udid: ${this.udid}]`;
        // TODO: HBsmith DEV-14260
        this.udid = udid;
        this.appKey = '';
        this.userAgent = '';
        this.apiSessionCreated = false;
        this.logger = new Logger(udid, 'iOS');
        //
    }

    private runWda(command: ControlCenterCommand): void {
        const udid = command.getUdid();
        const id = command.getId();
        // TODO: HBsmith DEV-14062
        const data = command.getData();
        this.appKey = data.appKey;
        this.userAgent = data.userAgent;
        //

        // TODO: HBsmith DEV-14260
        this.apiCreateSession()
            .then(() => {
                if (this.wda) {
                    const message: MessageRunWdaResponse = {
                        id,
                        type: 'run-wda',
                        data: {
                            udid: udid,
                            status: 'started',
                            code: -1,
                            text: 'WDA already started',
                        },
                    };
                    this.sendMessage(message);
                    return;
                }
                this.wda = WdaRunner.getInstance(udid);
                this.wda.on('status-change', ({ status, code, text }) => {
                    this.onStatusChange(command, status, code, text);
                });
                if (this.wda.isStarted()) {
                    this.onStatusChange(command, 'started');
                    // TODO: HBsmith DEV-14062, DEV-14260
                    this.apiSessionCreated = true;
                    this.wda.setUpTest(this.appKey);
                    //
                } else {
                    // TODO: HBsmith DEV-14062, DEV-14260
                    this.onStatusChange(command, 'started');
                    this.apiSessionCreated = true;
                    this.wda.start().then(() => {
                        this.wda?.setUpTest(this.appKey);
                    });
                    //
                }
            })
            .catch((e) => {
                this.onStatusChange(command, 'error', -1, e.message);
                this.ws.close(4900, e.message);
                this.logger.error(e);
            });
        //
    }

    private onStatusChange = (command: ControlCenterCommand, status: WdaStatus, code?: number, text?: string): void => {
        const id = command.getId();
        const udid = command.getUdid();
        const type = 'run-wda';
        const message: MessageRunWdaResponse = {
            id,
            type,
            data: {
                udid,
                status,
                code,
                text,
            },
        };
        this.sendMessage(message);
    };

    private requestWda(command: ControlCenterCommand): void {
        if (!this.wda) {
            return;
        }
        this.wda
            .request(command)
            .then((response) => {
                this.sendMessage({
                    id: command.getId(),
                    type: command.getType(),
                    data: {
                        success: true,
                        response,
                    },
                });
            })
            .catch((e) => {
                this.sendMessage({
                    id: command.getId(),
                    type: command.getType(),
                    data: {
                        success: false,
                        error: e.message,
                    },
                });
            });
    }

    protected onSocketMessage(event: WS.MessageEvent): void {
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(event.data.toString());
        } catch (e) {
            console.error(`[${WebDriverAgentProxy.TAG}], Received message: ${event.data}. Error: ${e.message}`);
            return;
        }
        const type = command.getType();
        switch (type) {
            case ControlCenterCommand.RUN_WDA:
                this.runWda(command);
                break;
            case ControlCenterCommand.REQUEST_WDA:
                this.requestWda(command);
                break;
            default:
                throw new Error(`Unsupported command: "${type}"`);
        }
    }

    public release(): void {
        // TODO: HBSmith DEV-14062, DEV-14260
        if (!this.apiSessionCreated || !this.udid) {
            return;
        }
        this.wda?.tearDownTest();
        //
        super.release();
        if (this.wda) {
            this.wda.release();
        }
        // TODO: HBsmith DEV-14260
        this.apiDeleteSession();
        //
    }

    // TODO: HBsmith DEV-14260
    private async apiCreateSession() {
        const host = Config.getInstance().getRamielApiServerEndpoint();
        const api = `/real-devices/${this.udid}/control/`;
        const hh = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf8' };
        const tt = Utils.getTimestamp();
        const pp = {
            POST: api,
            timestamp: tt,
            'user-agent': this.userAgent,
        };
        const data = qs.stringify({
            POST: api,
            timestamp: tt,
            'user-agent': this.userAgent,
            signature: Utils.getSignature(pp, tt),
        });
        const url = `${host}${api}`;
        const tag = WebDriverAgentProxy.TAG;

        await axios
            .post(url, data, {
                headers: hh,
            })
            .then((rr) => {
                this.logger.info(`[${tag}] success to create session. resp code: ${rr.status}`);
            })
            .catch((error) => {
                this.logger.error(`[${tag}] failed to create a session. resp code: ${error.response.status}`);
                let msg = `[${WebDriverAgentProxy.TAG}] failed to create a session for ${this.udid}`;
                if (!('response' in error)) msg = msg = `undefined response in error`;
                else if (409 == error.response.status) {
                    msg = `사용 중인 장비입니다`;
                    if (this.userAgent) msg += ` (${this.userAgent})`;
                } else if (503 == error.response.status) msg = `장비의 연결이 끊어져있습니다`;
                error.message = msg;
                throw error;
            });
    }

    private apiDeleteSession() {
        if (!this.udid) return;

        const host = Config.getInstance().getRamielApiServerEndpoint();
        const api = `/real-devices/${this.udid}/control/`;
        const hh = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf8' };
        const tt = Utils.getTimestamp();
        const pp = {
            DELETE: api,
            timestamp: tt,
            'user-agent': this.userAgent,
        };
        const data = qs.stringify({
            DELETE: api,
            timestamp: tt,
            'user-agent': this.userAgent,
            signature: Utils.getSignature(pp, tt),
        });
        const url = `${host}${api}`;
        const tag = WebDriverAgentProxy.TAG;

        axios
            .delete(url, {
                headers: hh,
                data: data,
            })
            .then((rr) => {
                this.logger.info(`[${tag}] success to delete a session. resp code: ${rr.status}`);
            })
            .catch((error) => {
                this.logger.error(`[${tag}] failed to delete a session. resp code: ${error.response.status}`);
            });
    }
    //
}

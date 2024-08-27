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
import { Utils, Logger } from '../../Utils'; // TODO: HBsmith
import qs from 'qs';
import axios from 'axios';

export class WebDriverAgentProxy extends Mw {
    public static readonly TAG = 'WebDriverAgentProxy';
    protected name: string;
    private wda?: WdaRunner;
    // TODO: HBsmith
    private appKey: string;
    private userAgent: string;
    private apiSessionCreated: boolean;
    private logger: Logger;
    private lastHeartbeat: number;
    private heartbeatTimer: NodeJS.Timeout;
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
        // TODO: HBsmith
        this.udid = udid;
        this.appKey = '';
        this.userAgent = '';
        this.apiSessionCreated = false;
        this.logger = new Logger(udid, 'iOS');
        this.lastHeartbeat = Date.now();
        this.heartbeatTimer = setInterval(() => {
            if (Date.now() - this.lastHeartbeat < 120 * 1000) {
                return;
            }
            if (this.wda) {
                const message: MessageRunWdaResponse = {
                    id: -1,
                    type: 'run-wda',
                    data: {
                        udid,
                        status: WdaStatus.ERROR,
                        code: -1,
                        text: 'Heartbeat timeout',
                    },
                };
                this.sendMessage(message);
            }
            this.ws.close(4900, 'Heartbeat timeout');
        }, 1000);
        //
    }

    private runWda(command: ControlCenterCommand): void {
        const udid = command.getUdid();
        const id = command.getId();
        // TODO: HBsmith
        const data = command.getData();
        this.appKey = data.appKey;
        this.userAgent = data.userAgent;
        //

        // TODO: HBsmith
        this.apiCreateSession()
            .then(() => {
                this.apiSessionCreated = true;
                //
                if (this.wda) {
                    const message: MessageRunWdaResponse = {
                        id,
                        type: 'run-wda',
                        data: {
                            udid,
                            status: WdaStatus.STARTED,
                            code: -1,
                            text: 'WDA already started',
                        },
                    };
                    this.sendMessage(message);
                    return;
                }
                this.wda = WdaRunner.getInstance(udid);
                this.wda.on('status-change', ({ status, code, text, detail, method }) => {
                    this.onStatusChange(command, status, code, text, detail, method);
                });
                if (this.wda.isStarted()) {
                    this.onStatusChange(command, WdaStatus.STARTED);
                    // TODO: HBsmith
                    return this.wda.setUpTest(this.appKey).catch((e) => {
                        e.text = '장비 초기화 실패';
                        throw e;
                    });
                    //
                } else {
                    // TODO: HBsmith
                    this.onStatusChange(command, WdaStatus.STARTED);
                    return this.wda
                        .start()
                        .then(() => {
                            return this.wda?.setUpTest(this.appKey);
                        })
                        .catch((e) => {
                            e.text = 'WebDriverAgent 재실행 중. 5분 뒤 다시 시도해 주세요.';
                            throw e;
                        });
                    //
                }
            })
            .catch((e) => {
                const mm = e.text || e.message || '알 수 없는 이유로 장비 초기화에 실패하였습니다.';
                this.onStatusChange(command, WdaStatus.ERROR, -1, mm);
                this.ws.close(4900, e.message);
                this.logger.error(e.stack);
            });
        //
    }

    private onStatusChange = (
        command: ControlCenterCommand,
        status: WdaStatus,
        code?: number,
        text?: string,
        detail?: string,
        method?: string,
    ): void => {
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
                detail,
                method,
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
            // TODO: HBsmith
            case ControlCenterCommand.HEARTBEAT:
                this.lastHeartbeat = Date.now();
                break;
            //
            default:
                throw new Error(`Unsupported command: "${type}"`);
        }
    }

    public release(): void {
        // TODO: HBSmith
        if (!this.apiSessionCreated || !this.udid) {
            return;
        }

        clearInterval(this.heartbeatTimer);

        new Promise((resolve) => setTimeout(resolve, 3000)).then(async () => {
            try {
                await this.wda?.tearDownTest();
            } catch (e) {
                this.logger.error(e);
            } finally {
                super.release();
                if (this.wda) {
                    this.wda.release();
                }

                setTimeout(() => {
                    this.apiDeleteSession();
                }, 3000);
            }
        });
        //
    }

    // TODO: HBsmith
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
            signature: Utils.getSignature(pp),
        });
        const url = `${host}${api}`;
        const tag = WebDriverAgentProxy.TAG;

        return await axios
            .post(url, data, {
                headers: hh,
            })
            .then((rr) => {
                this.logger.info(`[${tag}] success to create session. resp code: ${rr.status}`);
            })
            .catch((e) => {
                e.message = `[${WebDriverAgentProxy.TAG}] failed to create a session for ${this.udid}`;
                if (e.response) {
                    if (409 === e.response.status) {
                        const userAgent = e.response.data['user-agent'];
                        e.ramiel_message = e.message = '사용 중인 장비입니다';
                        if (userAgent) e.message += ` (${userAgent})`;
                        e.ramiel_contexts = { 'User Agent': userAgent };
                    } else if (410 === e.response.status) {
                        e.ramiel_message = e.message = '장비의 연결이 끊어져 있습니다';
                    }
                } else if (e.request) {
                    e.ramiel_message = e.message = 'api server is not responding';
                } else {
                    e.ramiel_message = e.message;
                }
                throw e;
            });
    }

    public static deleteSession(udid: string, userAgent: string, logger: Logger | null = null) {
        const host = Config.getInstance().getRamielApiServerEndpoint();
        const api = `/real-devices/${udid}/control/`;
        const hh = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf8' };
        const tt = Utils.getTimestamp();
        const pp = {
            DELETE: api,
            timestamp: tt,
            'user-agent': userAgent,
        };
        const data = qs.stringify({
            DELETE: api,
            timestamp: tt,
            'user-agent': userAgent,
            signature: Utils.getSignature(pp),
        });
        const url = `${host}${api}`;
        const tag = WebDriverAgentProxy.TAG;

        axios
            .delete(url, {
                headers: hh,
                data: data,
            })
            .then((rr) => {
                if (logger) logger.info(`[${tag}] success to delete session. resp code: ${rr.status}`);
            })
            .catch((e) => {
                let status;
                try {
                    status = e.response && e.response.status ? e.response.status : 'unknown_iOS';
                } catch {
                    status = e.toString();
                }
                console.error(Utils.getTimeISOString(), `[${tag}] failed to delete a session: ${status}`);
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
            signature: Utils.getSignature(pp),
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
            .catch((e) => {
                if (e.response) {
                    this.logger.error(`[${tag}] failed to create a session: ${e.response.status}`);
                } else if (e.request) {
                    this.logger.error(`[${tag}] failed to create a session: api server is not reponding`);
                } else {
                    this.logger.error(`[${tag}] failed to create a session: ${e.stack}`);
                }
            });
    }
    //
}

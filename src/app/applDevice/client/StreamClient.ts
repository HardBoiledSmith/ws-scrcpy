import { BaseClient } from '../../client/BaseClient';
import { ParamsStream } from '../../../types/ParamsStream';
import { SimpleInteractionHandler } from '../../interactionHandler/SimpleInteractionHandler';
import { BasePlayer, PlayerClass } from '../../player/BasePlayer';
import ScreenInfo from '../../ScreenInfo';
import { WdaProxyClient } from './WdaProxyClient';
import { ParsedUrlQuery, ParsedUrlQueryInput } from 'querystring';
import { ACTION } from '../../../common/Action';
import { ApplMoreBox } from '../toolbox/ApplMoreBox';
import { ApplToolBox } from '../toolbox/ApplToolBox';
import Size from '../../Size';
import Util from '../../Util';
import ApplDeviceDescriptor from '../../../types/ApplDeviceDescriptor';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import { DeviceTracker } from './DeviceTracker';
import { WdaStatus } from '../../../common/WdaStatus';
import { MessageRunWdaResponse } from '../../../types/MessageRunWdaResponse';
import { QVHackToolBox2 } from '../toolbox/QVHackToolBox2';

const WAIT_CLASS = 'wait';
const TAG = 'StreamClient';

export interface StreamClientEvents {
    'wda:status': WdaStatus;
}

export abstract class StreamClient<T extends ParamsStream> extends BaseClient<T, StreamClientEvents> {
    public static ACTION = 'MUST_OVERRIDE';
    protected static players: Map<string, PlayerClass> = new Map<string, PlayerClass>();

    public static registerPlayer(playerClass: PlayerClass): void {
        if (playerClass.isSupported()) {
            this.players.set(playerClass.playerFullName, playerClass);
        }
    }

    public static getPlayers(): PlayerClass[] {
        return Array.from(this.players.values());
    }

    private static getPlayerClass(playerName?: string): PlayerClass | undefined {
        let playerClass: PlayerClass | undefined;
        for (const value of this.players.values()) {
            if (value.playerFullName === playerName || value.playerCodeName === playerName) {
                playerClass = value;
            }
        }
        return playerClass;
    }

    public static createPlayer(udid: string, playerName?: string): BasePlayer {
        if (!playerName) {
            throw Error('Must provide player name');
        }
        const playerClass = this.getPlayerClass(playerName);
        if (!playerClass) {
            throw Error(`Unsupported player "${playerName}"`);
        }
        return new playerClass(udid);
    }

    public static createEntryForDeviceList(
        descriptor: ApplDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): Array<HTMLElement | DocumentFragment | undefined> {
        const entries: Array<HTMLElement | DocumentFragment> = [];
        const players = this.getPlayers();
        players.forEach((playerClass) => {
            const { playerCodeName, playerFullName } = playerClass;
            const playerTd = document.createElement('div');
            playerTd.classList.add(blockClass);
            playerTd.setAttribute(DeviceTracker.AttributePlayerFullName, encodeURIComponent(playerFullName));
            playerTd.setAttribute(DeviceTracker.AttributePlayerCodeName, encodeURIComponent(playerCodeName));
            const q: ParsedUrlQueryInput = {
                action: this.ACTION,
                player: playerCodeName,
                udid: descriptor.udid,
            };
            const link = DeviceTracker.buildLink(q, `Stream (${playerFullName})`, params);
            playerTd.appendChild(link);
            entries.push(playerTd);
        });
        return entries;
    }

    protected static getMaxSize(controlButtons: HTMLElement): Size | undefined {
        if (!controlButtons) {
            return;
        }
        const body = document.body;
        // TODO: HBsmith
        const width = ((body.clientWidth - controlButtons.clientWidth) & ~15) * 0.9;
        const height = (body.clientHeight & ~15) * 0.9;
        //
        return new Size(width, height);
    }

    private waitForWda?: Promise<void>;
    protected touchHandler?: SimpleInteractionHandler;
    protected readonly wdaProxy: WdaProxyClient;
    protected name: string;
    protected udid: string;
    protected deviceName = '';
    protected videoWrapper: HTMLElement;
    protected deviceView?: HTMLDivElement;
    protected moreBox?: HTMLElement;
    protected player?: BasePlayer;
    // TODO: HBsmith
    protected appKey?: string;
    protected userAgent?: string;
    //

    protected constructor(params: ParsedUrlQuery | T) {
        super(params);
        this.udid = this.params.udid;
        this.wdaProxy = new WdaProxyClient({ ...this.params, action: ACTION.PROXY_WDA });
        this.name = `[${TAG}:${this.udid}]`;
        // TODO: HBsmith
        this.appKey = 'app_key' in params ? params['app_key']?.toString() : undefined;
        this.userAgent = 'user-agent' in params ? params['user-agent']?.toString() : undefined;
        //

        const controlHeaderView = document.createElement('div');
        controlHeaderView.className = 'control-header';

        const qvhackToolBox2 = QVHackToolBox2.createToolBox(this.wdaProxy);
        const controlButtons2 = qvhackToolBox2.getHolderElement();
        controlHeaderView.appendChild(controlButtons2);

        document.body.appendChild(controlHeaderView);
        //
        this.videoWrapper = document.createElement('div');
        this.videoWrapper.className = `video`;
        this.setWdaStatusNotification(WdaStatus.STARTING);
    }

    public get action(): string {
        return StreamClient.ACTION;
    }

    public parseParameters(params: ParsedUrlQuery): ParamsStream {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== this.action) {
            throw Error('Incorrect action');
        }
        return {
            ...typedParams,
            action,
            udid: Util.parseStringEnv(params.udid),
            player: Util.parseStringEnv(params.player),
        };
    }

    public createPlayer(udid: string, playerName?: string): BasePlayer {
        return StreamClient.createPlayer(udid, playerName);
    }

    public getMaxSize(controlButtons: HTMLElement): Size | undefined {
        return StreamClient.getMaxSize(controlButtons);
    }

    protected async runWebDriverAgent(): Promise<void> {
        if (!this.waitForWda) {
            this.wdaProxy.on('wda-status', this.handleWdaStatus);
            // TODO: HBsmith
            this.waitForWda = this.wdaProxy
                .runWebDriverAgent(this.appKey, this.userAgent)
                .then(this.handleWdaStatus)
                .finally(() => {
                    this.videoWrapper?.classList.remove(WAIT_CLASS);
                });
            //
        }
        return this.waitForWda;
    }

    // TODO: HBsmith
    private logWdaStatus(response: MessageRunWdaResponse): void {
        const data = response.data;
        const statusText = document.getElementById('control-header-device-status-text');

        let msg = `[${data.status}]`;
        if (!!data.text) msg += ` ${data.text}`;
        if (statusText) statusText.textContent = msg;
        if (data.detail) console.log(data.detail);
        this.emit('wda:status', data.status);
    }
    //

    protected handleWdaStatus = (message: MessageRunWdaResponse): void => {
        const data = message.data;
        this.setWdaStatusNotification(data.status);
        switch (data.status) {
            case WdaStatus.STARTING:
            case WdaStatus.STARTED:
            case WdaStatus.STOPPED:
            case WdaStatus.ERROR:
            case WdaStatus.IN_ACTION:
            case WdaStatus.END_ACTION:
                this.logWdaStatus(message);
                break;
            case WdaStatus.SET_UP_DEVICE_INFO:
                if (data.text) {
                    this.deviceName = data.text;
                }
                const headerText = document.getElementById('control-header-device-name-text');
                if (headerText) {
                    headerText.textContent = `${this.deviceName} (${this.udid})`;
                }
                break;
            case WdaStatus.SET_UP_GIT_INFO:
                const gitHashText = document.getElementById('control-footer-hash-name-text');
                if (gitHashText && data.text) {
                    gitHashText.textContent = data.text;
                }
                break;
            case WdaStatus.SET_UP:
            case WdaStatus.SET_UP_SCREEN_ON:
            case WdaStatus.END_SET_UP:
                this.logWdaStatus(message);
                const videoLayer = document.getElementById('video-layer');
                if (!videoLayer) {
                    break;
                }
                if (data.status === WdaStatus.SET_UP) {
                    videoLayer.style.display = 'none';
                } else {
                    videoLayer.style.display = '';
                }
                break;
            default:
                this.logWdaStatus(message);
                throw Error(`Unknown WDA status: '${data.status}'`);
        }
    };

    protected setTouchListeners(player: BasePlayer): void {
        if (this.touchHandler) {
            return;
        }
        this.touchHandler = new SimpleInteractionHandler(player, this.wdaProxy);
    }

    protected onInputVideoResize = (screenInfo: ScreenInfo): void => {
        this.wdaProxy.setScreenInfo(screenInfo);
    };

    public onStop(ev?: string | Event): void {
        if (ev && ev instanceof Event && ev.type === 'error') {
            console.error(TAG, ev);
        }
        if (this.deviceView) {
            const parent = this.deviceView.parentElement;
            if (parent) {
                parent.removeChild(this.deviceView);
            }
        }
        if (this.moreBox) {
            const parent = this.moreBox.parentElement;
            if (parent) {
                parent.removeChild(this.moreBox);
            }
        }
        this.wdaProxy.stop();
        this.player?.stop();
    }

    public setWdaStatusNotification(status: WdaStatus): void {
        // TODO: HBsmith
        if (
            [
                WdaStatus.STARTING,
                WdaStatus.IN_ACTION,
                WdaStatus.SET_UP,
                WdaStatus.SET_UP_DEVICE_INFO,
                WdaStatus.SET_UP_SCREEN_ON,
            ].includes(status)
        ) {
            this.videoWrapper.classList.add(WAIT_CLASS);
        } else {
            this.videoWrapper.classList.remove(WAIT_CLASS);
        }
        //
    }

    protected createMoreBox(udid: string, player: BasePlayer): ApplMoreBox {
        return new ApplMoreBox(udid, player, this.wdaProxy);
    }

    protected startStream(inputPlayer?: BasePlayer): void {
        const { udid, player: playerName } = this.params;
        if (!udid) {
            throw Error(`Invalid udid value: "${udid}"`);
        }
        let player: BasePlayer;
        if (inputPlayer) {
            player = inputPlayer;
        } else {
            player = this.createPlayer(udid, playerName);
        }
        this.setTouchListeners(player);
        player.pause();

        const deviceView = document.createElement('div');
        deviceView.className = 'device-view';

        const applMoreBox = this.createMoreBox(udid, player);
        applMoreBox.setOnStop(this);
        const moreBox: HTMLElement = applMoreBox.getHolderElement();
        const applToolBox = ApplToolBox.createToolBox(udid, player, this, this.wdaProxy, moreBox);
        const controlButtons = applToolBox.getHolderElement();
        deviceView.appendChild(controlButtons);
        deviceView.appendChild(this.videoWrapper);
        deviceView.appendChild(moreBox);
        player.setParent(this.videoWrapper);
        player.on('input-video-resize', this.onInputVideoResize);

        document.body.appendChild(deviceView);
        const bounds = this.getMaxSize(controlButtons);
        if (bounds) {
            player.setBounds(bounds);
        }
        this.player = player;
    }

    public getDeviceName(): string {
        return this.deviceName;
    }
}

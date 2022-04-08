import { BaseClient } from '../../client/BaseClient';
import { ParamsStream } from '../../../types/ParamsStream';
import { SimpleInteractionHandler } from '../../interactionHandler/SimpleInteractionHandler';
import { BasePlayer, PlayerClass } from '../../player/BasePlayer';
import ScreenInfo from '../../ScreenInfo';
import { WdaProxyClient } from './WdaProxyClient';
import { ParsedUrlQuery, ParsedUrlQueryInput } from 'querystring';
import { ACTION } from '../../../common/Action';
import { QVHackMoreBox } from '../toolbox/QVHackMoreBox';
import { QVHackToolBox } from '../toolbox/QVHackToolBox';
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
        // TODO: HBsmith DEV-14062
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
    protected videoWrapper?: HTMLElement;
    protected deviceView?: HTMLDivElement;
    protected moreBox?: HTMLElement;
    protected player?: BasePlayer;
    // TODO: HBsmith DEV-14062
    protected appKey?: string;
    protected userAgent?: string;
    //

    protected constructor(params: ParsedUrlQuery | T) {
        super(params);
        this.udid = this.params.udid;
        this.wdaProxy = new WdaProxyClient({ ...this.params, action: ACTION.PROXY_WDA });
        this.name = `[${TAG}:${this.udid}]`;
        // TODO: HBsmith DEV-14062, DEV-14260, DEV-14464
        // @ts-ignore
        this.appKey = params['app_key']?.toString();
        // @ts-ignore
        this.userAgent = params['user-agent']?.toString();
        //

        const controlHeaderView = document.createElement('div');
        controlHeaderView.className = 'control-header';

        const qvhackToolBox2 = QVHackToolBox2.createToolBox(this.wdaProxy);
        const controlButtons2 = qvhackToolBox2.getHolderElement();
        controlHeaderView.appendChild(controlButtons2);

        document.body.appendChild(controlHeaderView);
        //
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
            this.waitForWda = this.wdaProxy
                .runWebDriverAgent(this.appKey, this.userAgent)
                .then(this.handleWdaStatus)
                .finally(() => {
                    this.videoWrapper?.classList.remove(WAIT_CLASS);
                });
        }
        return this.waitForWda;
    }

    protected handleWdaStatus = (message: MessageRunWdaResponse): void => {
        // TODO: HBsmith DEV-14062
        const statusText = document.getElementById('control-header-device-status-text');
        //
        const data = message.data;
        switch (data.status) {
            case 'starting':
            case 'started':
            case 'stopped':
            case 'error':
                // TODO: HBsmith DEV-14062, DEV-14260
                let msg = `[${data.status}]`;
                if (!!data.text) msg += ` ${data.text}`;
                if (statusText) statusText.textContent = msg;
                //
                this.emit('wda:status', data.status);
                break;
            default:
                // TODO: HBsmith DEV-14062
                if (statusText) statusText.textContent = status;
                //
                throw Error(`Unknown WDA status: '${status}'`);
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

        const qvhackMoreBox = new QVHackMoreBox(udid, player);
        qvhackMoreBox.setOnStop(this);
        const moreBox: HTMLElement = qvhackMoreBox.getHolderElement();
        const qvhackToolBox = QVHackToolBox.createToolBox(udid, player, this, this.wdaProxy, moreBox);
        const controlButtons = qvhackToolBox.getHolderElement();
        deviceView.appendChild(controlButtons);
        const video = document.createElement('div');
        // TODO: HBsmith DEV-14062
        // video.className = `video ${WAIT_CLASS}`;
        video.classList.add('video');
        //
        deviceView.appendChild(video);
        deviceView.appendChild(moreBox);
        player.setParent(video);
        player.on('input-video-resize', this.onInputVideoResize);
        this.videoWrapper = video;

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
import { ParamsStream } from '../../../types/ParamsStream';
import { ACTION } from '../../../common/Action';
import { ParsedUrlQuery } from 'querystring';
import { StreamClient } from './StreamClient';
import { BasePlayer, PlayerClass } from '../../player/BasePlayer';
import { WdaStatus } from '../../../common/WdaStatus';
import { ApplMjpegMoreBox } from '../toolbox/ApplMjpegMoreBox';
// TODO: HBsmith
import { KeyEventListener, KeyInputHandler } from '../KeyInputHandler';
import { WDAMethod } from '../../../common/WDAMethod';
//

const TAG = '[StreamClientMJPEG]';

export class StreamClientMJPEG
    extends StreamClient<ParamsStream>
    // TODO: HBsmith DEV-14440
    implements KeyEventListener {
    //
    public static ACTION = ACTION.STREAM_MJPEG;
    protected static players: Map<string, PlayerClass> = new Map<string, PlayerClass>();

    public static start(params: ParsedUrlQuery | ParamsStream): StreamClientMJPEG {
        // TODO: HBsmith DEV-14440
        const cc = new StreamClientMJPEG(params);
        KeyInputHandler.addEventListener(cc);
        return cc;
        //
    }

    constructor(params: ParsedUrlQuery | ParamsStream) {
        super(params);
        this.name = `[${TAG}:${this.udid}]`;
        this.udid = this.params.udid;
        this.runWebDriverAgent().then(() => {
            this.startStream();
            this.player?.play();
            // TODO: HBsmith
            this.setBodyClass('stream');

            const headerText = document.getElementById('control-header-device-name-text');
            if (headerText) headerText.textContent = `${this.deviceName} (${this.udid})`;
            //
        });
        this.on('wda:status', (status) => {
            if (status === WdaStatus.STOPPED) {
                this.player?.stop();
            } else if (status === WdaStatus.STARTED) {
                this.player?.play();
            }
        });
    }

    // TODO: HBsmith
    public onKeyEvent(key: string): void {
        this.wdaProxy.requestWebDriverAgent(WDAMethod.SEND_A_KEY, { key });
    }

    public onStop(ev?: string | Event): void {
        KeyInputHandler.removeEventListener(this);
        super.onStop(ev);
    }
    //

    public get action(): string {
        return StreamClientMJPEG.ACTION;
    }

    public createPlayer(udid: string, playerName?: string): BasePlayer {
        return StreamClientMJPEG.createPlayer(udid, playerName);
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    protected createMoreBox(udid: string, player: BasePlayer): ApplMjpegMoreBox {
        return new ApplMjpegMoreBox(udid, player, this.wdaProxy);
    }
}

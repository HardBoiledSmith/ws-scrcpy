import { Request, Response } from 'express';
import MjpegProxy from 'node-mjpeg-proxy';
import { WdaRunner } from '../appl-device/services/WDARunner';
import { WdaStatus } from '../../common/WdaStatus';
import { Utils } from '../Utils';

export class MjpegProxyFactory {
    proxyRequest = async (req: Request, res: Response): Promise<void> => {
        const { udid } = req.params;
        if (!udid) {
            res.destroy();
            return;
        }

        // TODO: HBsmith
        let ii = 0;
        const wda = await WdaRunner.getInstance(udid);
        while (!wda.isStarted() && ii < 10) {
            ii += 1;
            await Utils.sleep(1000);
        }
        if (!wda.isStarted()) {
            wda.emit('status-change', { status: WdaStatus.ERROR, text: '대기 시간 초과: 화면 전송 세션' });
            return;
        }
        const port = wda.mjpegPort;
        const url = `http://127.0.0.1:${port}`;
        const proxy = new MjpegProxy(url);
        proxy.on('streamstop', (): void => {
            wda.release();
        });
        proxy.on('error', (data: { msg: Error; url: string }): void => {
            console.error('msg: ' + data.msg);
            console.error('url: ' + data.url);
        });
        proxy.proxyRequest(req, res);
        //
    };
}

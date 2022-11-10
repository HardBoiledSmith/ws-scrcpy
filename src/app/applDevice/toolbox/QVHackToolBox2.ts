import BtnHomePng from '../../../public/images/buttons/btn-home.png';
import BtnSendTextPng from '../../../public/images/buttons/btn-send-text.png';
import BtnTerminateAppPng from '../../../public/images/buttons/btn-terminate-app.png';
import BtnUnlockPng from '../../../public/images/buttons/btn-unlock.png';
import { Optional, ToolBoxElement } from '../../toolbox/ToolBoxElement';
import { WdaProxyClient } from '../client/WdaProxyClient';

const BUTTONS = [
    {
        title: 'Unlock',
        name: 'unlock',
        icon: BtnUnlockPng,
        type: 'unlock',
    },
    {
        title: 'Home',
        name: 'home',
        icon: BtnHomePng,
        type: 'pressButton',
    },
    {
        title: 'Send Text',
        name: 'sendText',
        icon: BtnSendTextPng,
        type: 'sendText',
    },
    {
        title: 'Terminate App',
        name: 'terminateApp',
        icon: BtnTerminateAppPng,
        type: 'terminateApp',
    },
];

export class ToolBoxButton2 extends ToolBoxElement<HTMLButtonElement> {
    private readonly btn: HTMLButtonElement;

    constructor(title: string, icon: string, optional?: Optional) {
        super(title, optional);
        const btn = document.createElement('button');
        btn.classList.add('control-header-button');
        btn.title = title;

        const img = document.createElement('img');
        img.src = icon;
        img.classList.add('control-header-button-img');

        btn.appendChild(img);
        this.btn = btn;
    }

    public getElement(): HTMLButtonElement {
        return this.btn;
    }

    public getAllElements(): HTMLElement[] {
        return [this.btn];
    }
}

export class QVHackToolBox2 {
    private readonly holder: HTMLElement;

    protected constructor(list: ToolBoxElement<any>[]) {
        this.holder = document.createElement('div');
        this.holder.classList.add('control-header');
        list.forEach((item) => {
            item.getAllElements().forEach((el) => {
                this.holder.appendChild(el);
            });
        });

        const controlHeaderText = document.createElement('div');
        controlHeaderText.id = 'control-header-device-name-text';
        controlHeaderText.className = 'control-header-device-name-text';
        this.holder.appendChild(controlHeaderText);

        const controlHeaderStatusText = document.createElement('div');
        controlHeaderStatusText.id = 'control-header-device-status-text';
        controlHeaderStatusText.className = 'control-header-device-status-text';
        this.holder.appendChild(controlHeaderStatusText);

        const controlFooterView = document.createElement('div');
        controlFooterView.className = 'control-footer';

        const controlFooterText = document.createElement('div');
        controlFooterText.id = 'control-footer-hash-name-text';
        controlFooterText.className = 'control-footer-hash-name-text';

        document.body.appendChild(controlFooterView);
        controlFooterView.appendChild(controlFooterText);
    }

    public static createToolBox(wdaConnection: WdaProxyClient): QVHackToolBox2 {
        const list = BUTTONS.slice();
        const elements: ToolBoxElement<any>[] = list.map((item) => {
            const button = new ToolBoxButton2(item.title, item.icon, {
                name: item.name,
            });
            switch (item.type) {
                case 'pressButton':
                    button.addEventListener('click', (_, element) => {
                        if (!element.optional?.name) {
                            return;
                        }
                        const { name } = element.optional;
                        wdaConnection.pressButton(name);
                    });
                    break;
                case 'unlock':
                case 'sendText':
                case 'terminateApp':
                    button.addEventListener('click', (_, element) => {
                        if (!element.optional?.name) {
                            return;
                        }
                        const { name } = element.optional;
                        wdaConnection.pressButton2(name);
                    });
                    break;
            }
            return button;
        });
        return new QVHackToolBox2(elements);
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }
}

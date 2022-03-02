import BtnHomePng from '../../../public/images/buttons/btn-home.png';
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
    }

    public static createToolBox(wdaConnection: WdaProxyClient): QVHackToolBox2 {
        const list = BUTTONS.slice();
        const handler1 = <K extends keyof HTMLElementEventMap, T extends HTMLElement>(
            _: K,
            element: ToolBoxElement<T>,
        ) => {
            if (!element.optional?.name) {
                return;
            }
            const { name } = element.optional;
            wdaConnection.pressButton(name);
        };
        const handler2 = <K extends keyof HTMLElementEventMap, T extends HTMLElement>(
            _: K,
            element: ToolBoxElement<T>,
        ) => {
            if (!element.optional?.name) {
                return;
            }
            const { name } = element.optional;
            wdaConnection.pressButton2(name);
        };
        const elements: ToolBoxElement<any>[] = list.map((item) => {
            const button = new ToolBoxButton2(item.title, item.icon, {
                name: item.name,
            });
            if (item.type === 'pressButton') button.addEventListener('click', handler1);
            else if (item.type === 'unlock') button.addEventListener('click', handler2);
            return button;
        });
        return new QVHackToolBox2(elements);
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }
}

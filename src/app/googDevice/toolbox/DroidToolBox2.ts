import KeyEvent from '../android/KeyEvent';
import BtnUnlockPng from '../../../public/images/buttons/btn-unlock.png';
import BtnBackPng from '../../../public/images/buttons/btn-back.png';
import BtnDoubleUp from '../../../public/images/buttons/btn-double-up.png';
import BtnDoubleDown from '../../../public/images/buttons/btn-double-down.png';
import BtnHomePng from '../../../public/images/buttons/btn-home.png';
import BtnLock from '../../../public/images/buttons/btn-lock.png';
import BtnReboot from '../../../public/images/buttons/btn-reboot.png';
import BtnRotatePng from '../../../public/images/buttons/btn-rotate.png';
import BtnSendText from '../../../public/images/buttons/btn-send-text.png';
import BtnTerminateAppPng from '../../../public/images/buttons/btn-terminate-app.png';
import { CommandControlMessage } from '../../controlMessage/CommandControlMessage';
import { ControlMessage } from '../../controlMessage/ControlMessage';
import { KeyCodeControlMessage } from '../../controlMessage/KeyCodeControlMessage';
import { Optional, ToolBoxElement } from '../../toolbox/ToolBoxElement';
import { StreamClientScrcpy } from '../client/StreamClientScrcpy';

const BUTTONS = [
    {
        title: 'Unlock',
        code: KeyEvent.KEYCODE_MENU,
        icon: BtnUnlockPng,
        type: 'KeyCodeControlMessage',
    },
    {
        title: 'Home',
        code: KeyEvent.KEYCODE_HOME,
        icon: BtnHomePng,
        type: 'KeyCodeControlMessage',
    },
    {
        title: 'Rotate',
        code: KeyEvent.KEYCODE_APP_SWITCH,
        icon: BtnRotatePng,
        type: 'CommandControlMessage',
    },
    {
        title: 'Back',
        code: KeyEvent.KEYCODE_BACK,
        icon: BtnBackPng,
        type: 'KeyCodeControlMessage',
    },
    {
        title: 'SendText',
        icon: BtnSendText,
        type: 'CommandControlMessage',
    },
    {
        title: 'SwipeUp',
        icon: BtnDoubleUp,
        type: 'CommandControlMessage',
    },
    {
        title: 'SwipeDown',
        icon: BtnDoubleDown,
        type: 'CommandControlMessage',
    },
    {
        title: 'TerminateApp',
        icon: BtnTerminateAppPng,
        type: 'CommandControlMessage',
    },
    {
        title: 'Unlock',
        code: KeyEvent.KEYCODE_SLEEP,
        icon: BtnLock,
        type: 'KeyCodeControlMessage',
    },
    {
        title: 'Reboot',
        icon: BtnReboot,
        type: 'CommandControlMessage',
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

export class DroidToolBox2 {
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

    public static createToolBox(client: StreamClientScrcpy): DroidToolBox2 {
        const list = BUTTONS.slice();
        const handler = <K extends keyof HTMLElementEventMap, T extends HTMLElement>(
            type: K,
            element: ToolBoxElement<T>,
        ) => {
            const action = type === 'mousedown' ? KeyEvent.ACTION_DOWN : KeyEvent.ACTION_UP;
            if (element.optional?.type === 'KeyCodeControlMessage') {
                const event = new KeyCodeControlMessage(action, element.optional?.code, 0, 0);
                client.sendMessage(event);
            } else if (element.optional?.type === 'CommandControlMessage') {
                const title = element.optional?.title;
                switch (title) {
                    case 'Rotate': {
                        const action = ControlMessage.TYPE_ROTATE_DEVICE;
                        const event = new CommandControlMessage(action);
                        client.sendMessage(event);
                        break;
                    }
                    case 'SendText': {
                        const text = prompt('텍스트를 입력해 주세요');
                        if (!text) {
                            break;
                        }
                        client.sendMessage(CommandControlMessage.createSetClipboardCommand(text));

                        const kk = KeyEvent.KEYCODE_PASTE;
                        let eventPasteKey = new KeyCodeControlMessage(KeyEvent.ACTION_DOWN, kk, 0, 0);
                        client.sendMessage(eventPasteKey);
                        eventPasteKey = new KeyCodeControlMessage(KeyEvent.ACTION_UP, kk, 0, 0);
                        client.sendMessage(eventPasteKey);
                        break;
                    }
                    case 'SwipeUp': {
                        const event = CommandControlMessage.createAdbControlCommand(
                            ControlMessage.TYPE_ADB_CONTROL_SWIPE_UP,
                        );
                        client.sendMessage(event);
                        break;
                    }
                    case 'SwipeDown': {
                        const event = CommandControlMessage.createAdbControlCommand(
                            ControlMessage.TYPE_ADB_CONTROL_SWIPE_DOWN,
                        );
                        client.sendMessage(event);
                        break;
                    }
                    case 'Reboot': {
                        const cc = prompt('재부팅하시겠습니까? "확인"을 입력해 주세요');
                        if (cc !== '확인') {
                            break;
                        }
                        const event = CommandControlMessage.createAdbControlCommand(ControlMessage.TYPE_ADB_REBOOT);
                        client.sendMessage(event);
                        alert('재부팅 중입니다. 5분 뒤 다시 접속해주세요.');
                        window.close();
                        break;
                    }
                    case 'TerminateApp': {
                        const event = CommandControlMessage.createAdbControlCommand(
                            ControlMessage.TYPE_ADB_TERMINATE_APP,
                        );
                        client.sendMessage(event);
                        break;
                    }
                }
            } else {
                console.log('ERROR: wrong type');
            }
        };

        const elements: ToolBoxElement<any>[] = list.map((item) => {
            const button = new ToolBoxButton2(item.title, item.icon, {
                code: item.code,
                type: item.type,
                title: item.title,
            });

            if (item.type === 'KeyCodeControlMessage') {
                button.addEventListener('mousedown', handler);
            }
            button.addEventListener('mouseup', handler);
            return button;
        });

        return new DroidToolBox2(elements);
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }
}

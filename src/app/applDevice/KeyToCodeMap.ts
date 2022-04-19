import UIEventsCode from '../UIEventsCode';

export const KeyToCodeMap = new Map([
    [UIEventsCode.Backquote, '`'],
    [UIEventsCode.Backslash, '\\'],
    [UIEventsCode.BracketLeft, '('],
    [UIEventsCode.BracketRight, ')'],
    [UIEventsCode.Comma, ','],
    [UIEventsCode.Digit0, '0'],
    [UIEventsCode.Digit1, '1'],
    [UIEventsCode.Digit2, '2'],
    [UIEventsCode.Digit9, '9'],
    [UIEventsCode.Digit3, '3'],
    [UIEventsCode.Digit4, '4'],
    [UIEventsCode.Digit5, '5'],
    [UIEventsCode.Digit6, '6'],
    [UIEventsCode.Digit7, '7'],
    [UIEventsCode.Digit8, '8'],
    [UIEventsCode.Equal, '='],
    // [UIEventsCode.IntlRo, ''],
    [UIEventsCode.IntlYen, '₩'],
    [UIEventsCode.KeyA, 'a'],
    [UIEventsCode.KeyB, 'b'],
    [UIEventsCode.KeyC, 'c'],
    [UIEventsCode.KeyD, 'd'],
    [UIEventsCode.KeyE, 'e'],
    [UIEventsCode.KeyF, 'f'],
    [UIEventsCode.KeyG, 'g'],
    [UIEventsCode.KeyH, 'h'],
    [UIEventsCode.KeyI, 'i'],
    [UIEventsCode.KeyJ, 'j'],
    [UIEventsCode.KeyK, 'k'],
    [UIEventsCode.KeyL, 'l'],
    [UIEventsCode.KeyM, 'm'],
    [UIEventsCode.KeyN, 'n'],
    [UIEventsCode.KeyO, 'o'],
    [UIEventsCode.KeyP, 'p'],
    [UIEventsCode.KeyQ, 'q'],
    [UIEventsCode.KeyR, 'r'],
    [UIEventsCode.KeyS, 's'],
    [UIEventsCode.KeyT, 't'],
    [UIEventsCode.KeyU, 'u'],
    [UIEventsCode.KeyV, 'v'],
    [UIEventsCode.KeyW, 'w'],
    [UIEventsCode.KeyX, 'x'],
    [UIEventsCode.KeyY, 'y'],
    [UIEventsCode.KeyZ, 'z'],
    [UIEventsCode.Minus, '-'],
    [UIEventsCode.Period, '.'],
    [UIEventsCode.Quote, "'"],
    [UIEventsCode.Semicolon, ';'],
    [UIEventsCode.Slash, '/'],
    // [UIEventsCode.KanaMode, ''],
    // [UIEventsCode.Delete, ''],
    // [UIEventsCode.End, ''],
    // [UIEventsCode.Help, ''],
    // [UIEventsCode.Home, ''],
    // [UIEventsCode.Insert, ''],
    // [UIEventsCode.PageDown, ''],
    // [UIEventsCode.PageUp, ''],
    // [UIEventsCode.AltLeft, ''],
    // [UIEventsCode.AltRight, ''],
    [UIEventsCode.Backspace, '\b'],
    // [UIEventsCode.CapsLock, ''],
    // [UIEventsCode.ControlLeft, ''],
    // [UIEventsCode.ControlRight, ''],
    [UIEventsCode.Enter, '\n'],
    // [UIEventsCode.MetaLeft, KeyEvent.KEYCODE_META_LEFT],
    // [UIEventsCode.MetaRight, KeyEvent.KEYCODE_META_RIGHT],
    // [UIEventsCode.ShiftLeft, KeyEvent.KEYCODE_SHIFT_LEFT],
    // [UIEventsCode.ShiftRight, KeyEvent.KEYCODE_SHIFT_RIGHT],
    [UIEventsCode.Space, ' '],
    [UIEventsCode.Tab, '\t'],
    // [UIEventsCode.ArrowLeft, KeyEvent.KEYCODE_DPAD_LEFT],
    // [UIEventsCode.ArrowUp, KeyEvent.KEYCODE_DPAD_UP],
    // [UIEventsCode.ArrowRight, KeyEvent.KEYCODE_DPAD_RIGHT],
    // [UIEventsCode.ArrowDown, KeyEvent.KEYCODE_DPAD_DOWN],

    // [UIEventsCode.NumLock, KeyEvent.KEYCODE_NUM_LOCK],
    [UIEventsCode.Numpad0, '0'],
    [UIEventsCode.Numpad1, '1'],
    [UIEventsCode.Numpad2, '2'],
    [UIEventsCode.Numpad3, '3'],
    [UIEventsCode.Numpad4, '4'],
    [UIEventsCode.Numpad5, '5'],
    [UIEventsCode.Numpad6, '6'],
    [UIEventsCode.Numpad7, '7'],
    [UIEventsCode.Numpad8, '8'],
    [UIEventsCode.Numpad9, '9'],
    // [UIEventsCode.NumpadAdd, KeyEvent.KEYCODE_NUMPAD_ADD],
    [UIEventsCode.NumpadComma, ','],
    [UIEventsCode.NumpadDecimal, '.'],
    [UIEventsCode.NumpadDivide, '/'],
    [UIEventsCode.NumpadEnter, '\n'],
    [UIEventsCode.NumpadEqual, '='],
    [UIEventsCode.NumpadMultiply, '*'],
    [UIEventsCode.NumpadParenLeft, '('],
    [UIEventsCode.NumpadParenRight, ')'],
    [UIEventsCode.NumpadSubtract, '-'],

    // [UIEventsCode.Escape, ''],
    // [UIEventsCode.F1, ''],
    // [UIEventsCode.F2, ''],
    // [UIEventsCode.F3, ''],
    // [UIEventsCode.F4, ''],
    // [UIEventsCode.F5, ''],
    // [UIEventsCode.F6, ''],
    // [UIEventsCode.F7, ''],
    // [UIEventsCode.F8, ''],
    // [UIEventsCode.F9, ''],
    // [UIEventsCode.F10, ''],
    // [UIEventsCode.F11, ''],
    // [UIEventsCode.F12, ''],
    // [UIEventsCode.Fn, ''],
    // [UIEventsCode.PrintScreen, ''],
    // [UIEventsCode.Pause, ''],
]);

export const ToUpperCodeMap = new Map([
    ['`', '~'],
    ['1', '!'],
    ['2', '@'],
    ['3', '#'],
    ['4', '$'],
    ['5', '%'],
    ['6', '^'],
    ['7', '&'],
    ['8', '*'],
    ['9', '('],
    ['0', ')'],
    ['-', '_'],
    ['+', '+'],
    ['[', '{'],
    [']', '}'],
    ['\\', '|'],
    [';', ':'],
    ["'", '"'],
    [',', '<'],
    ['.', '>'],
    ['/', '?'],
]);
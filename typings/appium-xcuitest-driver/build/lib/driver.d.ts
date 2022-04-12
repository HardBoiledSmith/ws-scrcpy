import { BaseDriver } from 'appium-base-driver';

declare interface ScreenInfo {
    statusBarSize: { width: number; height: number };
    scale: number;
}

declare interface Gesture {
    action: string;
    options: {
        x?: number;
        y?: number;
        ms?: number;
    };
}

declare class XCUITestDriver extends BaseDriver {
    constructor(opts: Record<string, any>, shouldValidateCaps: boolean);
    public createSession(...args: any): Promise<any>;
    public findElement(strategy: string, selector: string): Promise<any>;
    public getSize(element: any): Promise<{ width: number; height: number } | undefined>;
    public getScreenInfo(): Promise<ScreenInfo>;
    public performTouch(gestures: Gesture[]): Promise<any>;
    public mobilePressButton(args: { name: string }): Promise<any>;
    public stop(): Promise<void>;
    public deleteSession(): Promise<void>;
    public wda: any;
    // TODO: HBsmith DEV-14062, DEV-14260
    public activateApp(bundleId: string): Promise<void>;
    public mobileLaunchApp(args: { bundleId: string }): Promise<any>;
    public mobileGetActiveAppInfo(): Promise<any>;
    // public launchApp(bundleId: string): Promise<void>; // FIXME: NOT WORKING
    public terminateApp(bundleId: string): Promise<boolean>;
    public isAppInstalled(bundleId: string): Promise<boolean>;
    public keys(value: string): Promise<void>;
    public lock(): Promise<void>;
    public unlock(): Promise<void>;
    //
}

export default XCUITestDriver;
export { XCUITestDriver };

import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { Configuration, HostItem, ServerItem } from '../types/Configuration';
import { EnvName } from './EnvName';
import YAML from 'yaml';

const DEFAULT_PORT = 8000;

const YAML_RE = /^.+\.(yaml|yml)$/i;
const JSON_RE = /^.+\.(json|js)$/i;

export class Config {
    private static instance?: Config;
    public static getInstance(defaultConfig?: Configuration): Config {
        if (!defaultConfig) {
            defaultConfig = {
                runGoogTracker: false,
                runApplTracker: false,
                announceGoogTracker: false,
                announceApplTracker: false,
            };
            /// #if INCLUDE_GOOG
            defaultConfig.runGoogTracker = true;
            defaultConfig.announceGoogTracker = true;
            /// #endif

            /// #if INCLUDE_APPL
            defaultConfig.runApplTracker = true;
            defaultConfig.announceApplTracker = true;
            /// #endif
        }
        if (!this.instance) {
            this.instance = new Config(defaultConfig);
        }
        return this.instance;
    }

    constructor(private fullConfig: Configuration) {
        // TODO: HBsmith
        let configPath = process.env[EnvName.CONFIG_PATH];
        if (!configPath) {
            configPath = '/etc/ramiel/ws-scrcpy/settings_local.json';
            let aa = configPath;
            if (!fs.existsSync(aa)) {
                configPath = '_provisioning/configuration/etc/ramiel/ws-scrcpy/settings_local.json';
                aa = path.resolve(process.cwd(), configPath);
                if (!fs.existsSync(aa)) {
                    console.error(`Can't find configuration file "${aa}"`);
                    return;
                }
            }
        }

        const isAbsolute = configPath.startsWith('/');
        configPath = isAbsolute ? configPath : path.resolve(process.cwd(), configPath);
        if (!fs.existsSync(configPath)) {
            throw Error(`Can't find configuration file "${configPath}"`);
        }
        //

        if (configPath.match(YAML_RE)) {
            this.fullConfig = YAML.parse(this.readFile(configPath));
        } else if (configPath.match(JSON_RE)) {
            this.fullConfig = JSON.parse(this.readFile(configPath));
        } else {
            throw Error(`Unknown file type: ${configPath}`);
        }
    }

    public readFile(pathString: string): string {
        const isAbsolute = pathString.startsWith('/');
        const absolutePath = isAbsolute ? pathString : path.resolve(process.cwd(), pathString);
        if (!fs.existsSync(absolutePath)) {
            throw Error(`Can't find file "${absolutePath}"`);
        }
        return fs.readFileSync(absolutePath).toString();
    }

    public getHostList(): HostItem[] {
        if (!this.fullConfig.remoteHostList || !this.fullConfig.remoteHostList.length) {
            return [];
        }
        const hostList: HostItem[] = [];
        this.fullConfig.remoteHostList.forEach((item) => {
            const { hostname, port, secure, useProxy } = item;
            if (Array.isArray(item.type)) {
                item.type.forEach((type) => {
                    hostList.push({
                        hostname,
                        port,
                        secure,
                        useProxy,
                        type,
                    });
                });
            } else {
                hostList.push({ hostname, port, secure, useProxy, type: item.type });
            }
        });
        return hostList;
    }

    public getRunLocalGoogTracker(): boolean {
        return !!this.fullConfig.runGoogTracker;
    }

    public getAnnounceLocalGoogTracker(): boolean {
        if (typeof this.fullConfig.announceGoogTracker === 'boolean') {
            return this.fullConfig.announceGoogTracker;
        }
        return this.fullConfig.runGoogTracker === true;
    }

    public getRunLocalApplTracker(): boolean {
        return !!this.fullConfig.runApplTracker;
    }

    public getAnnounceLocalApplTracker(): boolean {
        if (typeof this.fullConfig.announceApplTracker === 'boolean') {
            return this.fullConfig.announceApplTracker;
        }
        return this.fullConfig.runApplTracker === true;
    }

    // TODO: HBsmith
    public getRamielApiServerEndpoint(): string {
        if (!this.fullConfig.ramielApiServerEndpoint) {
            return '';
        }

        let uu = this.fullConfig.ramielApiServerEndpoint || 'http://127.0.0.1:28000';
        if (!uu.toLowerCase().startsWith('http')) {
            // noinspection HttpUrlsUsage
            uu = `http://${uu}`;
        }
        return uu;
    }

    getServerPort(): number {
        return this.fullConfig.serverPort || 28500 || DEFAULT_PORT;
    }

    getSentryDSN(): string {
        return this.fullConfig.sentryDSN || '';
    }

    getSentryProject(): string {
        return this.fullConfig.sentryProject || '';
    }

    getHMACIdcKey(): string {
        return this.fullConfig.HMAC_IDC_KEY || '';
    }
    //

    public getServers(): ServerItem[] {
        if (!Array.isArray(this.fullConfig.server)) {
            return [
                {
                    secure: false,
                    // TODO: HBsmith
                    port: this.getServerPort(),
                    //
                },
            ];
        }
        return this.fullConfig.server;
    }
}

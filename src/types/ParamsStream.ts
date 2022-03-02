import { ParamsBase } from './ParamsBase';

export interface ParamsStream extends ParamsBase {
    udid: string;
    player: string;
    app_key?: string;
    user_agent?: string;
}

import { StatsListener, watchFile } from 'fs'
import path from 'path'
export abstract class Module {
    protected watchFile(file: string, listener: StatsListener) {
        watchFile(path.resolve(path.join(process.cwd(), file)), listener)
    }
}
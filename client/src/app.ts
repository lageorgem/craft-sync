import fs from 'fs';
import crypto from 'crypto';
import {WebSocket} from 'ws';
import WebSocketMessageHandler, {FileDifference, SyncStatus} from './WebSocketMessageHandler';
import {Observable} from "rxjs";
import {FileEntry, FileWatcher} from "./files/FileWatcher";
import FileHandler from "./files/FileHandler";

const CONFIG_FILE = 'config.json';

/**
 * Represents the configuration for CraftSync.
 */
interface Config {
    folderPath: string;
    server: string;
}

/**
 * Core class for handling synchronization of files.
 */
class CraftSync {
    private static instance: CraftSync;
    private config: Config;
    private messageHandler: WebSocketMessageHandler;

    private fileWatcher?: FileWatcher;

    private hashesProcessing = new Set();

    private constructor() {
        this.config = this.loadConfig() as Config;

        const [_, __, folderPath, server] = process.argv;

        if (folderPath && server) {
            this.config.folderPath = folderPath;
            this.config.server = server;
            this.saveConfig(this.config);
        } else {
            console.error('Usage: npm run craft-sync /path/to/drive/folder example.com');
            process.exit(1);
        }

        const ws = new WebSocket(`ws://${server}:3000`);
        this.messageHandler = new WebSocketMessageHandler(ws);

        ws.on('open', this.onWebSocketOpen.bind(this));
    }

    /**
     * Returns the singleton instance of CraftSync.
     * @returns The instance of CraftSync.
     */
    public static getInstance(): CraftSync {
        if (!this.instance) {
            this.instance = new CraftSync();
        }
        return this.instance;
    }

    /**
     * Loads the configuration from disk.
     * @returns The loaded configuration or an empty object.
     */
    private loadConfig(): Config | {} {
        if (fs.existsSync(CONFIG_FILE)) {
            const rawConfig = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(rawConfig);
        }
        return {};
    }

    /**
     * Saves the given configuration to disk.
     * @param config - The configuration to be saved.
     */
    private saveConfig(config: Config) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    }

    /**
     * Generates a hash for a given file list string.
     * @param filelist - The string representation of a file list.
     * @returns The SHA-256 hash.
     */
    private generateHash(filelist: string): string {
        return crypto.createHash('sha256').update(filelist).digest('hex');
    }

    /**
     * Callback for when a file change is detected.
     * @param fileEntries - The list of files that have changed.
     */
    private onFileChange(fileEntries: FileEntry[]) {
        const fileListStringified = fileEntries
            .map((file: FileEntry) => `${file.fileName}~${file.etag}`)
            .sort()
            .join(";");
        const hash = this.generateHash(fileListStringified);

        // Avoid duplicated callbacks
        if (this.hashesProcessing.has(hash)) {
            return;
        } else this.hashesProcessing.add(hash);

        const syncStatusObservable = this.messageHandler.sendCheckFilesUpdate(hash);

        syncStatusObservable.subscribe((syncStatus: SyncStatus) => {
            const shouldSync = syncStatus.update;
            if (shouldSync) {
                this.onSyncRequired(fileEntries);
            }
        })
    }

    /**
     * Callback for when synchronization is required.
     * @param fileEntries - The list of files that need to be synchronized.
     */
    private onSyncRequired(fileEntries: FileEntry[]) {
        const syncFileListObservable: Observable<FileDifference> = this.messageHandler.sendGetFileDiff(fileEntries);
        syncFileListObservable.subscribe(async (fileDiff: FileDifference) => {
            const fileHandler: FileHandler = new FileHandler(`http://${this.config.server}:3000`, this.config.folderPath);

            this.fileWatcher!.freeze();
            await fileHandler.handleFiles(fileDiff, this.config.folderPath);
            this.fileWatcher!.unfreeze();
        })
    }

    /**
     * Callback for when the WebSocket connection is established.
     */
    private async onWebSocketOpen() {
        this.fileWatcher = new FileWatcher(this.config.folderPath as string);
        let timeout: NodeJS.Timeout;

        // Watch for file changes
        await this.fileWatcher.watch((fileEntries) => {
            // Establish a 1s timeout that is reset on each callback.
            // This is useful if a folder is pasted into our drive, and multiple events are triggered at once
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.onFileChange(fileEntries)
            }, 1000)
        });
    }
}

CraftSync.getInstance();

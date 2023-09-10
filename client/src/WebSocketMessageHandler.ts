import { Observable, Subject } from 'rxjs';
import WebSocket from 'ws';
import {FileEntry, UniformFileEntry} from "./files/FileWatcher";


/**
 * Represents a message sent or received via a WebSocket connection.
 */
interface WebsocketMessage<T> {
    event: string;
    data: T;
}

/**
 * Represents the sync status of files.
 */
export interface SyncStatus {
    update: boolean;
}

/**
 * Represents the differences between the client's files and the server's.
 */
export interface FileDifference {
    toUpload: UniformFileEntry[];
    toUpdate: UniformFileEntry[];
    toDownload: UniformFileEntry[];
}

/**
 * A utility class to handle WebSocket messages.
 */
class WebSocketMessageHandler {
    private ws: WebSocket;
    private messageSubjects: { [key: string]: Subject<any> } = {};

    /**
     * Creates a new instance of WebSocketMessageHandler.
     * @param ws - The WebSocket instance to attach to.
     */
    constructor(ws: WebSocket) {
        this.ws = ws;
        this.ws.on('message', this.handleMessage.bind(this));
    }

    /**
     * Handles incoming WebSocket messages.
     * @param data - The raw WebSocket data received.
     */
    private handleMessage(data: WebSocket.Data) {
        const message: WebsocketMessage<any> = JSON.parse(data.toString());

        if (this.messageSubjects[message.event]) {
            this.messageSubjects[message.event].next(message.data);
            this.messageSubjects[message.event].complete();
            delete this.messageSubjects[message.event];
        }
    }

    /**
     * Sends a request to check for file updates.
     * @param clientHash - The hash representing the client's files state.
     * @returns An observable emitting the sync status.
     */
    public sendCheckFilesUpdate(clientHash: string): Observable<SyncStatus> {
        const subject = new Subject<SyncStatus>();
        this.messageSubjects['check-files-update'] = subject;

        this.ws.send(JSON.stringify({
            event: 'check-files-update',
            data: clientHash
        }));

        return subject.asObservable();
    }

    /**
     * Sends a request to get the difference between the client's files and the server's.
     * @param clientFileList - The list of the client's files.
     * @returns An observable emitting the file differences.
     */
    public sendGetFileDiff(clientFileList: FileEntry[]): Observable<FileDifference> {
        const subject = new Subject<FileDifference>();
        this.messageSubjects['get-file-diff'] = subject;

        this.ws.send(JSON.stringify({
            event: 'get-file-diff',
            data: clientFileList
        }));

        return subject.asObservable();
    }
}

export default WebSocketMessageHandler;

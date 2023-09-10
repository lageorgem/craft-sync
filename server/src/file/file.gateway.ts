import { SubscribeMessage, WebSocketGateway, WebSocketServer, WsResponse } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { FileEntry, FileService, UniformFileEntry } from './file.service';
import * as crypto from "crypto";

interface FileDifference {
  toUpload: UniformFileEntry[];
  toUpdate: UniformFileEntry[];
  toDownload: UniformFileEntry[];
}

interface SyncStatus {
  update: boolean;
}

/**
 * The FileGateway handles WebSocket communication related to file synchronizations.
 */
@WebSocketGateway()
export class FileGateway {
  @WebSocketServer()
  server: Server;

  /**
   * Constructs the FileGateway with a reference to the FileService.
   * @param fileService - The service handling file operations.
   */
  constructor(private readonly fileService: FileService) {}

  /**
   * Computes the hash for a given file list.
   * @param filelist - The string representation of the file list.
   * @returns A string hash value.
   */
  private computeFileListHash(filelist: string): string {
    return this.getHashCode(filelist);
  }

  /**
   * Handles the 'check-files-update' WebSocket message.
   * @param client - The WebSocket client.
   * @param clientHash - The file hash received from the client.
   * @returns A WebSocket response indicating whether an update is needed.
   */
  @SubscribeMessage('check-files-update')
  async checkFilesUpdate(client: any, clientHash: string): Promise<WsResponse<SyncStatus>> {
    const serverFileList: FileEntry[] = await this.fileService.listFilesInBucket();
    const fileListStringified: string = serverFileList.map((file) => `${file.fileName}~${file.etag}`)
        .sort()
        .join(";");
    const serverHash = this.computeFileListHash(fileListStringified);

    if (serverHash !== clientHash) {
      return { event: 'check-files-update', data: { update: true } };
    } else {
      return { event: 'check-files-update', data: { update: false } };
    }
  }

  /**
   * Handles the 'get-file-diff' WebSocket message.
   * @param client - The WebSocket client.
   * @param clientFileList - The list of files received from the client.
   * @returns A WebSocket response containing the differences between the server and client file lists.
   */
  @SubscribeMessage('get-file-diff')
  async getFileDiff(client: any, clientFileList: UniformFileEntry[]): Promise<WsResponse<FileDifference>> {
    const serverFileList = await this.fileService.listFilesInBucket();

    // Files to Upload
    const toUpload: UniformFileEntry[] = clientFileList.filter(clientFile => {
      const serverFile = serverFileList.find(f => f.fileName === clientFile.fileName);

      // If the file does not exist on the server
      return !serverFile;
    }).map(file => ({
      ...file,
      lastUpdated: file.lastUpdated
    }));

    // Files to Update
    const toUpdate: UniformFileEntry[] = clientFileList.filter(clientFile => {
      const serverFile = serverFileList.find(f => f.fileName === clientFile.fileName);

      if (!serverFile) return false;

      // If the file on the client is different and newer
      return clientFile.etag !== serverFile.etag && new Date(clientFile.lastUpdated) > new Date(serverFile.lastUpdated);
    }).map(file => ({
      ...file,
      lastUpdated: file.lastUpdated
    }));

    // Files to Download
    const toDownload: UniformFileEntry[] = serverFileList.filter(serverFile => {
      const clientFile = clientFileList.find(f => f.fileName === serverFile.fileName);

      // If the file does not exist on the client or if the server's file is different and newer
      return !clientFile || (clientFile.etag !== serverFile.etag && new Date(serverFile.lastUpdated) > new Date(clientFile.lastUpdated));
    }).map(file => ({
      ...file,
      lastUpdated: file.lastUpdated.toISOString()
    }));

    return { event: 'get-file-diff', data: { toUpload, toUpdate, toDownload } };
  }

  /**
   * Generates a hash code for a given string.
   * @param str - The input string.
   * @returns A string hash value.
   */
  private getHashCode(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}
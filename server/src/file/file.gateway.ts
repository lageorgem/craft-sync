import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { FileService } from './file.service';

@WebSocketGateway()
export class FileGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly fileService: FileService) {}

  /**
   * List all files in an S3 bucket
   * TODO: use some sort of caching for the file list, as doing S3 queries like this is not scalable
   * @private
   */
  private async getServerFileList(): Promise<string[]> {
    return this.fileService.listFilesInBucket();
  }

  private computeFileListHash(files: string[]): string {
    // Simple hash function for the demonstration, consider a more robust method in production
    return this.getHashCode(files.join(',')).toString();
  }

  @SubscribeMessage('check-files-update')
  async checkFilesUpdate(client: any, clientHash: string): Promise<any> {
    const serverFileList = await this.getServerFileList();
    const serverHash = this.computeFileListHash(serverFileList);

    if (serverHash !== clientHash) {
      return { update: true };
    } else {
      return { update: false };
    }
  }

  @SubscribeMessage('get-file-diff')
  async getFileDiff(client: any, clientFileList: any[]): Promise<{ toUpload: any[], toDownload: any[] }> {
    const serverFileList = await this.fileService.getFilesMetadata();

    // Files to Upload
    const toUpload = clientFileList.filter(clientFile => {
      const serverFile = serverFileList.find(f => f.filename === clientFile.filename);

      // If the file does not exist on the server or if the client's file is newer
      return !serverFile || new Date(clientFile.lastUpdated) > new Date(serverFile.lastUpdated);
    });

    // Files to Download
    const toDownload = serverFileList.filter(serverFile => {
      const clientFile = clientFileList.find(f => f.filename === serverFile.filename);

      // If the file does not exist on the client or if the server's file is newer
      return !clientFile || new Date(serverFile.lastUpdated) > new Date(clientFile.lastUpdated);
    });

    return { toUpload, toDownload };
  }

  private getHashCode(str: string) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
}
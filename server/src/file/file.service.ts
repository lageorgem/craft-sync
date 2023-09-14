import { Injectable, NotFoundException } from '@nestjs/common';
import {
    S3Client,
    ListObjectsV2Command,
    PutObjectCommand,
    DeleteObjectCommand,
    S3ClientConfig,
    GetObjectCommand,
} from '@aws-sdk/client-s3';

export interface UniformFileEntry extends Omit<FileEntry, 'lastUpdated'> {
    lastUpdated: string;
}

export interface FileEntry {
    fileName: string;
    lastUpdated: Date;
    etag: string;
}

/**
 * The FileService handles operations related to the AWS S3 bucket.
 */
@Injectable()
export class FileService {
    private s3: S3Client;

    /**
     * Constructs the FileService and initializes the S3 client.
     */
    constructor() {
        const config: S3ClientConfig = {
            region: 'us-east-1',
        };

        this.s3 = new S3Client(config);
    }

    /**
     * Lists files present in the S3 bucket.
     * @returns An array of FileEntry objects.
     */
    async listFilesInBucket(token?: string): Promise<FileEntry[]> {
        let filelist: FileEntry[] = [];
        const result = await this.s3.send(new ListObjectsV2Command({
            Bucket: 'craft-sync',
            ...(token && { ContinuationToken: token })
        }));
        if (result.IsTruncated) {
            const nextResult = await this.listFilesInBucket(result.NextContinuationToken);
            filelist = filelist.concat(nextResult);
        }
        if (result.KeyCount === 0) return [];
        filelist = filelist.concat(result.Contents.map(file => ({
            fileName: file.Key,
            lastUpdated: file.LastModified,
            etag: file.ETag,
        })).filter(key => key !== undefined));

        return filelist;
    }

    /**
     * Uploads a file to the S3 bucket.
     * @param dataBuffer - The data buffer of the file to upload.
     * @param filename - The name of the file to upload.
     */
    async uploadFile(dataBuffer: Buffer, filename: string) {
        return await this.s3.send(new PutObjectCommand({
            Bucket: 'craft-sync',
            Body: dataBuffer,
            Key: filename,
        }));
    }

    /**
     * Deletes a file from the S3 bucket.
     * @param fileKey - The key of the file to delete.
     */
    async deleteFile(fileKey: string) {
        return await this.s3.send(new DeleteObjectCommand({
            Bucket: 'craft-sync',
            Key: fileKey,
        }));
    }

    /**
     * Updates a file in the S3 bucket. Essentially, it deletes the old file and uploads a new one.
     * @param oldFileKey - The key of the old file.
     * @param dataBuffer - The data buffer of the new file.
     */
    async updateFile(oldFileKey: string, dataBuffer: Buffer) {
        await this.deleteFile(oldFileKey);
        return this.uploadFile(dataBuffer, oldFileKey);
    }

    /**
     * Downloads a file from the S3 bucket.
     * @param fileKey - The key of the file to download.
     * @returns A readable stream of the file data.
     * @throws NotFoundException if the specified file does not exist.
     */
    async downloadFile(fileKey: string): Promise<ReadableStream> {
        const result = await this.s3.send(new GetObjectCommand({
            Bucket: 'craft-sync',
            Key: fileKey,
        }));

        if (!result.Body) {
            throw new NotFoundException(`File ${fileKey} not found`);
        }

        return result.Body.transformToWebStream();
    }
}

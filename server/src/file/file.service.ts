import { Injectable } from '@nestjs/common';
import {
    S3Client,
    ListObjectsV2Command,
    PutObjectCommand,
    DeleteObjectCommand,
    S3ClientConfig
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileService {
    private s3: S3Client;

    constructor() {
        const config: S3ClientConfig = {
            region: 'us-east-1',
        };

        this.s3 = new S3Client(config);
    }

    async listFilesInBucket(): Promise<string[]> {
        const { Contents } = await this.s3.send(new ListObjectsV2Command({ Bucket: 'craft-sync' }));
        return Contents.map(file => file.Key).filter(key => key !== undefined) as string[];
    }

    async getFilesMetadata(): Promise<{ lastUpdated: Date, filename: string }[]> {
        const { Contents } = await this.s3.send(new ListObjectsV2Command({ Bucket: 'craft-sync' }));
        return Contents.map(file => ({
            filename: file.Key,
            lastUpdated: file.LastModified
        }));
    }

    async uploadFile(dataBuffer: Buffer, filename: string) {
        return await this.s3.send(new PutObjectCommand({
            Bucket: 'craft-sync',
            Body: dataBuffer,
            Key: `${uuidv4()}-${filename}`
        }));
    }

    async deleteFile(fileKey: string) {
        return await this.s3.send(new DeleteObjectCommand({
            Bucket: 'craft-sync',
            Key: fileKey
        }));
    }

    async updateFile(oldFileKey: string, dataBuffer: Buffer, filename: string) {
        await this.deleteFile(oldFileKey);
        return this.uploadFile(dataBuffer, filename);
    }
}

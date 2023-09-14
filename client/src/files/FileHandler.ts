import axios, {RawAxiosRequestHeaders} from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as FormData from 'form-data';
import {FileDifference} from "../WebSocketMessageHandler";

/**
 * A handler to manage file operations including upload and download.
 */
class FileHandler {
    /** Base URL for API endpoints */
    private readonly baseURL: string;
    /** Base folder path for file operations */
    private readonly baseFolder: string;

    /**
     * Creates a new instance of FileHandler.
     * @param baseURL - The base URL for API endpoints.
     * @param baseFolder - The base folder path for file operations.
     */
    constructor(baseURL: string, baseFolder: string) {
        this.baseURL = baseURL;
        this.baseFolder = baseFolder;
    }

    /**
     * Handle upload, update and download operations based on file differences.
     * @param fileDifference - The differences between files to determine actions.
     * @param localFolderPath - The local folder path for file operations.
     */
    public async handleFiles({ toUpload, toUpdate, toDownload }: FileDifference, localFolderPath: string) {
        await this.uploadFiles(toUpload.map(file => path.join(localFolderPath, file.fileName)));
        await this.uploadFiles(toUpdate.map(file => path.join(localFolderPath, file.fileName)), true);
        await this.downloadFiles(toDownload.map(file => file.fileName), localFolderPath);
    }

    /**
     * Uploads the specified files.
     * @param filesToUpload - The list of files to be uploaded.
     * @param update - Indicates whether the file is being updated (default is false).
     */
    private async uploadFiles(filesToUpload: string[], update: boolean = false): Promise<void> {
        const batches = this.batchArray(filesToUpload, 50);
        for (const batch of batches) {
            const uploadPromises = [];

            for (const filePath of batch) {
                const promise = async (fileLocation: string) => {
                    const fileStream = fs.createReadStream(fileLocation);
                    const relativePath = path.relative(this.baseFolder, fileLocation);

                    const formData: FormData = new FormData();
                    formData.append('file', fileStream);
                    formData.append('filePath', relativePath);

                    try {
                        const axiosVerb = update ? axios.put : axios.post;
                        await axiosVerb(`${this.baseURL}/file`, formData, {
                            headers: {
                                ...formData.getHeaders(), // Spread to get Content-Type header
                            } as RawAxiosRequestHeaders,
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity,
                            onUploadProgress: (progressEvent) => {
                                if (progressEvent?.total) {
                                    console.log(`${update ? 'Update' : 'Upload'} progress for ${relativePath}: ${(progressEvent.loaded / progressEvent.total) * 100}%`);
                                } else {
                                    console.log(`${update ? 'Updating' : 'Uploading'} ${relativePath}`);
                                }
                            }
                        });
                    } catch (error) {
                        console.error(`Failed to ${update ? 'update' : 'upload'} file ${relativePath}:`, error);
                    }
                }
                uploadPromises.push(promise(filePath));
            }

            await Promise.allSettled(uploadPromises);
        }
    }

    /**
     * Downloads the specified files.
     * @param filesToDownload - The list of files to be downloaded.
     * @param localFolderPath - The local folder path to save the downloaded files.
     */
    private async downloadFiles(filesToDownload: string[], localFolderPath: string): Promise<void> {
        const batches = this.batchArray(filesToDownload, 50);
        for (const batch of batches) {
            const downloadPromises = [];

            for (const filePath of batch) {
                const promise = async (fileLocation: string) => {
                    try {
                        const response = await axios.get(`${this.baseURL}/file/download/${fileLocation}`, { responseType: 'stream' });
                        const fileStream = fs.createWriteStream(path.join(localFolderPath, fileLocation));

                        response.data.pipe(fileStream); // Stream the file data directly to a file

                        fileStream.on('finish', () => {
                            console.log(`File ${fileLocation} downloaded successfully.`);
                        });

                        fileStream.on('error', (error) => {
                            console.error(`Failed to download and save file ${fileLocation}:`, error);
                        });
                    } catch (error) {
                        console.error(`Failed to download file ${fileLocation}:`, error);
                    }
                }
                downloadPromises.push(promise(filePath));
            }

            await Promise.all(downloadPromises);
        }
    }

    /**
     * Splits an array into batches.
     * @param array - The array to be split.
     * @param batchSize - The size of each batch.
     * @returns An array of batches.
     */
    private batchArray<T>(array: T[], batchSize: number): T[][] {
        const batches: T[][] = [];

        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }

        return batches;
    }
}

export default FileHandler;

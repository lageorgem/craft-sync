import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    Delete,
    Param,
    Put,
    NestInterceptor,
    Get, Res, StreamableFile, InternalServerErrorException, Body, Req
} from '@nestjs/common';
import { Request } from 'express';
import { FileService } from './file.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Readable } from "stream";
import streamWeb from "node:stream/web";

/**
 * The FileController handles HTTP requests related to files.
 */
@Controller('file')
export class FileController {

    /**
     * Constructs the FileController with a reference to the FileService.
     * @param fileService - The service handling file operations.
     */
    constructor(private readonly fileService: FileService) {}

    /**
     * Handles POST requests for file uploads.
     * @param file - The uploaded file.
     * @param filePath - The file path.
     * @returns An object indicating the success of the upload.
     */
    @Post('')
    @UseInterceptors(FileInterceptor('file') as unknown as NestInterceptor)
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('filePath') filePath: string
    ): Promise<{ ok: boolean }> {
        await this.fileService.uploadFile(file.buffer, filePath);
        return {
            ok: true
        };
    }

    /**
     * Handles DELETE requests to delete a file.
     * @param fileKey - The key for the file to be deleted.
     * @returns The result of the delete operation.
     */
    @Delete(':key')
    async deleteFile(@Param('key') fileKey: string) {
        return this.fileService.deleteFile(fileKey);
    }

    /**
     * Handles PUT requests for updating files.
     * @param file - The uploaded file.
     * @param filePath - The file path.
     * @returns The result of the update operation.
     */
    @Put('')
    @UseInterceptors(FileInterceptor('file') as unknown as NestInterceptor)
    async updateFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('filePath') filePath: string
    ) {
        return this.fileService.updateFile(filePath, file.buffer);
    }

    /**
     * Handles GET requests for downloading files.
     * @returns The streamable file for the client to download.
     * @throws {InternalServerErrorException} Throws an exception if an error occurs.
     * @param request - express request
     */
    @Get('download/*')
    async downloadFile(@Req() request: Request): Promise<StreamableFile> {
        try {
            const fileKey = request.params[0];
            const stream = await this.fileService.downloadFile(fileKey);
            const readable = Readable.fromWeb(stream as streamWeb.ReadableStream);
            return new StreamableFile(readable);
        } catch (error) {
            throw new InternalServerErrorException(error.message)
        }
    }
}

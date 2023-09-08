import {Controller, Post, UploadedFile, UseInterceptors, Delete, Param, Put, NestInterceptor} from '@nestjs/common';
import { FileService } from './file.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('file')
export class FileController {

    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file') as unknown as NestInterceptor)
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
        await this.fileService.uploadFile(file.buffer, file.originalname);
        return {
            ok: true
        };
    }

    @Delete(':key')
    async deleteFile(@Param('key') fileKey: string) {
        return this.fileService.deleteFile(fileKey);
    }

    // For this simple example, the update endpoint deletes the old file and uploads a new one.
    @Put('update/:key')
    @UseInterceptors(FileInterceptor('file') as unknown as NestInterceptor)
    async updateFile(
        @Param('key') oldFileKey: string,
        @UploadedFile() file: Express.Multer.File
    ) {
        return this.fileService.updateFile(oldFileKey, file.buffer, file.originalname);
    }
}

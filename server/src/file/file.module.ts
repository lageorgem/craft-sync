import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { FileGateway } from './file.gateway';

@Module({
  providers: [FileService, FileGateway],
  controllers: [FileController],
  exports: [FileService]
})
export class FileModule {}
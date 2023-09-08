import {Module} from '@nestjs/common';
import {FileModule} from './file/file.module';
import {FileGateway} from './file/file.gateway';

@Module({
  imports: [FileModule],
  controllers: [],
  providers: [FileGateway],
})
export class AppModule {}

import { SubscribeMessage, WebSocketGateway, OnGatewayInit, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()  // default namespace
export class EventsGateway implements OnGatewayInit {

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    console.log('Initialized!');
  }

  @SubscribeMessage('message')
  handleMessage(client: any, payload: string): string {
    return 'Hello world!';
  }
}
import WebSocket from 'ws';
import fs from 'node:fs';

const ws = new WebSocket('ws://wolf-sg.southeastasia.cloudapp.azure.com:18080/ws?chatId=debug-models-' + Date.now());
const timer = setTimeout(() => { ws.terminate(); process.exit(0); }, 15000);

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'message.receive',
    data: {
      messageId: 'msg-' + Date.now(),
      chatId: 'debug',
      chatType: 'direct',
      senderId: 'test',
      senderName: 'Test',
      messageType: 'text',
      content: '/models',
      timestamp: Date.now(),
    },
  }));
});

ws.on('message', (raw) => {
  const p = JSON.parse(raw.toString());
  if (p.type === 'message.send') {
    const c = p.data.content || '';
    fs.writeFileSync('/tmp/models_response.txt', c);
    fs.writeFileSync('/tmp/models_response_escaped.txt', JSON.stringify(c).slice(0, 1500));
    console.log('DONE - wrote to /tmp/models_response.txt');
    clearTimeout(timer);
    ws.close();
  }
});

ws.on('close', () => process.exit(0));
ws.on('error', (e) => { console.error(e.message); process.exit(1); });

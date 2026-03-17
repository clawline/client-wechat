import WebSocket from 'ws';

const serverUrl = process.argv[2] || 'ws://wolf-sg.southeastasia.cloudapp.azure.com:18080/ws';
const chatId = process.argv[3] || `codex-probe-${Date.now()}`;
const senderId = process.argv[4] || 'codex-probe-user';
const senderName = process.argv[5] || 'Codex Probe';
const prompt = process.argv[6] || 'Reply with a short confirmation that the generic channel is connected.';

const ws = new WebSocket(`${serverUrl}?chatId=${encodeURIComponent(chatId)}`);
let opened = false;
let receivedReply = false;

const timer = setTimeout(() => {
  console.error('Probe timed out without a full reply cycle.');
  ws.terminate();
  process.exit(1);
}, 20000);

ws.on('open', () => {
  opened = true;
  console.log('connected');
  ws.send(JSON.stringify({
    type: 'message.receive',
    data: {
      messageId: `msg-${Date.now()}`,
      chatId,
      chatType: 'direct',
      senderId,
      senderName,
      messageType: 'text',
      content: prompt,
      timestamp: Date.now(),
    },
  }));
});

ws.on('message', (raw) => {
  const packet = JSON.parse(raw.toString());
  console.log(JSON.stringify(packet));

  if (packet.type === 'message.send') {
    receivedReply = true;
    clearTimeout(timer);
    ws.close();
  }
});

ws.on('close', () => {
  clearTimeout(timer);
  if (!opened || !receivedReply) {
    process.exit(1);
    return;
  }
  process.exit(0);
});

ws.on('error', (error) => {
  clearTimeout(timer);
  console.error(error.message);
  process.exit(1);
});

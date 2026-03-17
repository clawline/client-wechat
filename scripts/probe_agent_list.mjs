import WebSocket from 'ws';

const serverUrl = process.argv[2] || 'ws://wolf-sg.southeastasia.cloudapp.azure.com:18080/ws';
const chatId = `agent-test-${Date.now()}`;

const ws = new WebSocket(`${serverUrl}?chatId=${encodeURIComponent(chatId)}`);

const timer = setTimeout(() => {
  console.log('Timed out — agent.list may not be supported on this server version.');
  ws.terminate();
  process.exit(0);
}, 10000);

ws.on('open', () => {
  console.log('connected');
  // Request agent list
  ws.send(JSON.stringify({
    type: 'agent.list.get',
    data: { requestId: `agent-list-${Date.now()}` },
  }));
});

ws.on('message', (raw) => {
  const packet = JSON.parse(raw.toString());
  console.log(JSON.stringify(packet, null, 2));

  if (packet.type === 'agent.list') {
    console.log('\n=== Agent list received ===');
    if (packet.data.agents) {
      packet.data.agents.forEach((a) => console.log(`  - ${a.id}: ${a.name} ${a.isDefault ? '(default)' : ''}`));
    }
    clearTimeout(timer);
    ws.close();
  }
});

ws.on('close', () => {
  clearTimeout(timer);
  process.exit(0);
});

ws.on('error', (err) => {
  clearTimeout(timer);
  console.error('Error:', err.message);
  process.exit(1);
});

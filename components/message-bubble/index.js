const { parseMarkdown } = require('../../utils/markdown');

Component({
  properties: {
    message: { type: Object, value: {} },
    messages: { type: Array, value: [] },
    agentEmoji: { type: String, value: '🤖' },
    isActive: { type: Boolean, value: false },
    delay: { type: Number, value: 0 },
  },
  observers: {
    'message.text, message.sender': function (text, sender) {
      if (sender !== 'user' && text) this.setData({ mdNodes: parseMarkdown(text) });
      else this.setData({ mdNodes: [] });
    },
    'message.replyTo, message.showReply, messages': function (replyTo, showReply, messages) {
      if (!replyTo || showReply === false) {
        this.setData({ replyToText: '' });
        return;
      }
      var quoted = (messages || []).find(function (m) { return m.id === replyTo; });
      if (!quoted) {
        this.setData({ replyToText: '' });
        return;
      }
      var text = (quoted.text || '').slice(0, 80);
      if ((quoted.text || '').length > 80) text += '…';
      this.setData({ replyToText: (quoted.sender === 'user' ? '我' : '对方') + ': ' + text });
    },
  },
  data: {
    mdNodes: [],
    replyToText: '',
  },
  methods: {
    handleBubbleTap() { this.triggerEvent('select', { messageId: this.properties.message.id }); },
    handleLongPress() { this.triggerEvent('reaction', { messageId: this.properties.message.id }); },
    handleReactionTap() { this.triggerEvent('reaction', { messageId: this.properties.message.id }); },
    handleLinkTap(event) {
      const href = event.currentTarget.dataset.href;
      if (href) {
        wx.setClipboardData({ data: href });
        wx.showToast({ title: '链接已复制', icon: 'none' });
      }
    },
    handleEditTap() { this.triggerEvent('editmsg', { messageId: this.properties.message.id }); },
    handleDeleteTap() { this.triggerEvent('deletemsg', { messageId: this.properties.message.id }); },
    handleReplyTap() { this.triggerEvent('replymsg', { messageId: this.properties.message.id }); },
    onRetryTap() { this.triggerEvent('retrymsg', { messageId: this.properties.message.id }); },
  },
});

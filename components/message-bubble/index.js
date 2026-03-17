const { parseMarkdown } = require('../../utils/markdown');

Component({
  properties: {
    message: {
      type: Object,
      value: {},
    },
    agentEmoji: {
      type: String,
      value: '🤖',
    },
    isActive: {
      type: Boolean,
      value: false,
    },
    delay: {
      type: Number,
      value: 0,
    },
  },
  observers: {
    'message.text, message.sender': function (text, sender) {
      if (sender !== 'user' && text) {
        this.setData({ mdNodes: parseMarkdown(text) });
      } else {
        this.setData({ mdNodes: [] });
      }
    },
    'message.replyTo': function (replyTo) {
      // Find the quoted message text from the parent page's messages
      if (!replyTo) {
        this.setData({ replyToText: '' });
        return;
      }
      var pages = getCurrentPages();
      var currentPage = pages[pages.length - 1];
      if (currentPage && currentPage.data && currentPage.data.messages) {
        var quoted = currentPage.data.messages.find(function (m) { return m.id === replyTo; });
        if (quoted) {
          var text = (quoted.text || '').slice(0, 80);
          if ((quoted.text || '').length > 80) text += '…';
          this.setData({ replyToText: (quoted.sender === 'user' ? 'You' : 'Bot') + ': ' + text });
        }
      }
    },
  },
  data: {
    mdNodes: [],
    replyToText: '',
  },
  methods: {
    handleBubbleTap() {
      this.triggerEvent('select', { messageId: this.properties.message.id });
    },
    handleLongPress() {
      this.triggerEvent('reaction', { messageId: this.properties.message.id });
    },
    handleReactionTap() {
      this.triggerEvent('reaction', { messageId: this.properties.message.id });
    },
    handleLinkTap(event) {
      const href = event.currentTarget.dataset.href;
      if (href) {
        wx.setClipboardData({ data: href });
        wx.showToast({ title: 'Link copied', icon: 'none' });
      }
    },
    handleEditTap() {
      this.triggerEvent('editmsg', { messageId: this.properties.message.id });
    },
    handleDeleteTap() {
      this.triggerEvent('deletemsg', { messageId: this.properties.message.id });
    },
    handleReplyTap() {
      this.triggerEvent('replymsg', { messageId: this.properties.message.id });
    },
  },
});

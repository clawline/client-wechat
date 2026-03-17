Component({
  properties: {
    chat: {
      type: Object,
      value: {},
    },
    delay: {
      type: Number,
      value: 0,
    },
  },
  methods: {
    handleTap() {
      this.triggerEvent('open', { chatId: this.properties.chat.id });
    },
  },
});

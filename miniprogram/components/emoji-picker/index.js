Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    emojiList: {
      type: Array,
      value: [],
    },
  },
  methods: {
    handleClose() {
      this.triggerEvent('close');
    },
    handleSelect(event) {
      this.triggerEvent('select', { emoji: event.currentTarget.dataset.emoji });
    },
  },
});

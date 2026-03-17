Component({
  properties: {
    item: {
      type: Object,
      value: {},
    },
  },
  methods: {
    handleTap() {
      if (this.properties.item.hasToggle) {
        this.triggerEvent('toggle', { key: this.properties.item.key });
        return;
      }

      this.triggerEvent('tap', {
        key: this.properties.item.key,
        navigateTo: this.properties.item.navigateTo || '',
      });
    },
  },
});

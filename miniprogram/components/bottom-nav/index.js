Component({
  properties: {
    items: {
      type: Array,
      value: [],
    },
    currentScreen: {
      type: String,
      value: '',
    },
    safeAreaBottom: {
      type: Number,
      value: 0,
    },
  },
  methods: {
    handleTap(event) {
      const { screen } = event.currentTarget.dataset;
      this.triggerEvent('navigate', { screen });
    },
  },
});

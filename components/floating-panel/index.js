Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    extraClass: {
      type: String,
      value: '',
    },
  },
  methods: {
    handleClose() {
      this.triggerEvent('close');
    },
    noop() {},
  },
});

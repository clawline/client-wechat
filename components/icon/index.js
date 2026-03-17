const assetMap = require('./asset-map');

Component({
  properties: {
    name: {
      type: String,
      value: '',
    },
    tone: {
      type: String,
      value: 'dark',
    },
    size: {
      type: String,
      value: '40rpx',
    },
    extraClass: {
      type: String,
      value: '',
    },
  },
  data: {
    src: '',
  },
  lifetimes: {
    attached() {
      this.resolveAsset();
    },
  },
  observers: {
    'name,tone': function handleChange() {
      this.resolveAsset();
    },
  },
  methods: {
    resolveAsset() {
      const { name, tone } = this.properties;
      const src = assetMap[`${name}:${tone}`] || assetMap[`${name}:dark`] || '';
      this.setData({ src });
    },
  },
});

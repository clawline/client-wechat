const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const { getConnectionState, getPreferenceForm, saveConnectionState, updatePreferenceForm } = require('../../utils/app-state');
const { redirectToScreen } = require('../../utils/routes');

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    preferenceForm: getPreferenceForm(),
  },

  onLoad() {
    this.setData({
      ...getPageChromeData(),
      preferenceForm: getPreferenceForm(),
    });
  },

  handleBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        redirectToScreen('profile');
      },
    });
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    const value = event.detail.value || '';
    const nextForm = {
      ...this.data.preferenceForm,
      [field]: value,
    };
    updatePreferenceForm(nextForm);
    this.setData({ preferenceForm: nextForm });
  },

  handleModelChange(event) {
    const nextForm = {
      ...this.data.preferenceForm,
      selectedModelIndex: Number(event.detail.value),
    };
    updatePreferenceForm(nextForm);
    this.setData({ preferenceForm: nextForm });
  },

  handleTemperatureChange(event) {
    const nextForm = {
      ...this.data.preferenceForm,
      temperature: Number(event.detail.value),
    };
    updatePreferenceForm(nextForm);
    this.setData({ preferenceForm: nextForm });
  },

  handleSave() {
    const connection = getConnectionState();
    const nextServerUrl = (this.data.preferenceForm.genericChannelUrl || '').trim();
    const nextDisplayName = (this.data.preferenceForm.displayName || '').trim();
    saveConnectionState({
      displayName: nextDisplayName,
      serverUrl: nextServerUrl,
      isPaired: connection.isPaired && !!nextServerUrl,
    });
    updatePreferenceForm({
      ...this.data.preferenceForm,
      displayName: nextDisplayName,
      genericChannelUrl: nextServerUrl,
    });
    this.setData({
      preferenceForm: {
        ...this.data.preferenceForm,
        displayName: nextDisplayName,
        genericChannelUrl: nextServerUrl,
      },
    });

    wx.showToast({
      title: 'Preferences saved locally.',
      icon: 'none',
    });
  },
});

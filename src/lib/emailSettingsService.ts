const STORAGE_KEY = 'em-final-inspection-email-settings';

export interface EmailSettings {
  recipients: string[];
}

const defaultSettings: EmailSettings = {
  recipients: []
};

export const emailSettingsService = {
  getSettings(): EmailSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading email settings:', error);
    }
    return defaultSettings;
  },

  saveSettings(settings: EmailSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving email settings:', error);
    }
  },

  getRecipients(): string[] {
    return this.getSettings().recipients;
  }
};

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const SETTINGS_DOC = 'final_inspection_email';

export interface EmailSettings {
  recipients: string[];
}

const defaultSettings: EmailSettings = {
  recipients: []
};

export const emailSettingsService = {
  async getSettings(): Promise<EmailSettings> {
    try {
      const docRef = doc(db, 'settings', SETTINGS_DOC);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          recipients: (data.recipients as string[]) || []
        };
      }
    } catch (error) {
      console.error('Error reading email settings from Firestore:', error);
    }
    return defaultSettings;
  },

  async saveSettings(settings: EmailSettings): Promise<void> {
    try {
      const docRef = doc(db, 'settings', SETTINGS_DOC);
      await setDoc(docRef, {
        recipients: settings.recipients,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving email settings to Firestore:', error);
      throw error;
    }
  },

  async getRecipients(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.recipients;
  }
};

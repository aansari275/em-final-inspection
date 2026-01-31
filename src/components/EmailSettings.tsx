import { useState, useEffect } from 'react';
import { emailSettingsService, EmailSettings as EmailSettingsType } from '../lib/emailSettingsService';
import { Mail, Plus, X, Save, Loader2 } from 'lucide-react';

export function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettingsType>({ recipients: [] });
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        // First try to load from Firestore
        let loadedSettings = await emailSettingsService.getSettings();

        // If Firestore is empty, check for localStorage data and migrate
        if (loadedSettings.recipients.length === 0) {
          const LOCAL_STORAGE_KEY = 'em-final-inspection-email-settings';
          const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (localData) {
            try {
              const parsedLocal = JSON.parse(localData);
              if (parsedLocal.recipients && parsedLocal.recipients.length > 0) {
                // Migrate localStorage data to Firestore
                await emailSettingsService.saveSettings(parsedLocal);
                loadedSettings = parsedLocal;
                // Clear localStorage after successful migration
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                console.log('Migrated email settings from localStorage to Firestore');
              }
            } catch (e) {
              console.error('Error migrating localStorage:', e);
            }
          }
        }

        setSettings(loadedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (settings.recipients.includes(email)) {
      alert('This email is already in the list');
      return;
    }

    setSettings(prev => ({
      ...prev,
      recipients: [...prev.recipients, email]
    }));
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    setSettings(prev => ({
      ...prev,
      recipients: prev.recipients.filter(e => e !== email)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await emailSettingsService.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email Settings</h2>
            <p className="text-sm text-gray-500">
              Configure email recipients for inspection reports
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-2 text-gray-600">Loading settings...</span>
          </div>
        ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Recipients
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Add
              </button>
            </div>
          </div>

          {settings.recipients.length > 0 ? (
            <div className="space-y-2">
              {settings.recipients.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-700">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No email recipients configured</p>
              <p className="text-sm">Add emails above to receive inspection reports</p>
            </div>
          )}

          <div className="pt-4 border-t">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : saved ? (
                <>
                  <Save size={18} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
        )}

        <div className="mt-6 p-4 bg-emerald-50 rounded-lg">
          <h3 className="text-sm font-medium text-emerald-900 mb-2">How it works</h3>
          <ul className="text-sm text-emerald-700 space-y-1">
            <li>• When you submit an inspection, a PDF report is generated</li>
            <li>• The report includes all inspection details and photos</li>
            <li>• An email with the PDF attached is sent to all recipients</li>
            <li>• Merchants linked to the buyer are auto-CC'd (primary + assistant)</li>
            <li>• Settings are synced across all devices via cloud</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

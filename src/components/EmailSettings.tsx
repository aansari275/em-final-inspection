import { useState, useEffect } from 'react';
import { emailSettingsService, EmailSettings as EmailSettingsType } from '../lib/emailSettingsService';
import { Mail, Plus, X, Save, Loader2 } from 'lucide-react';

export function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettingsType>({ recipients: [] });
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(emailSettingsService.getSettings());
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
      emailSettingsService.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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

        <div className="mt-6 p-4 bg-emerald-50 rounded-lg">
          <h3 className="text-sm font-medium text-emerald-900 mb-2">How it works</h3>
          <ul className="text-sm text-emerald-700 space-y-1">
            <li>• When you submit an inspection, a PDF report is generated</li>
            <li>• The report includes all inspection details and photos</li>
            <li>• An email with the PDF attached is sent to all recipients</li>
            <li>• Settings are saved locally on this device</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

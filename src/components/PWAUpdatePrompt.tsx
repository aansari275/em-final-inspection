import { useRegisterSW } from 'virtual:pwa-register/react';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 10 minutes
      if (r) {
        setInterval(() => r.update(), 10 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white border border-emerald-200 rounded-xl shadow-lg p-4 z-50">
      <p className="text-sm font-medium text-gray-800 mb-3">
        A new version is available. Save your work before updating.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => updateServiceWorker(true)}
          className="flex-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Update Now
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
        >
          Later
        </button>
      </div>
    </div>
  );
}

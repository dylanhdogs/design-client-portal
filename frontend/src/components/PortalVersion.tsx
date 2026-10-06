const appVersion = import.meta.env.VITE_APP_VERSION || '1.1.0';
const releaseId = import.meta.env.VITE_APP_RELEASE_ID || 'local build';

export default function PortalVersion({ tone = 'admin' }: { tone?: 'admin' | 'client' }) {
  return (
    <p
      className={`px-4 pb-2 text-[11px] ${tone === 'client' ? 'text-blue-300' : 'text-gray-400'}`}
      title={`Application version ${appVersion}; release ${releaseId}`}
    >
      Portal v{appVersion} · {releaseId}
    </p>
  );
}

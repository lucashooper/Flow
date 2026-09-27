interface FlowLoadingScreenProps {
  message?: string;
}

export function FlowLoadingScreen({
  message = 'Loading your workspace…',
}: FlowLoadingScreenProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ backgroundColor: '#121212' }}
    >
      <img
        src="/FlowIcon-Main.png"
        alt="Flow Notes"
        className="mb-6 h-14 w-14 rounded-2xl shadow-lg"
        style={{ boxShadow: '0 8px 32px rgba(160, 82, 45, 0.25)' }}
      />

      <div className="relative mb-5 h-9 w-9" aria-hidden="true">
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid rgba(160, 82, 45, 0.15)' }}
        />
        <div
          className="absolute inset-0 animate-spin rounded-full"
          style={{
            border: '2px solid transparent',
            borderTopColor: '#A0522D',
          }}
        />
      </div>

      <p className="text-sm font-medium tracking-wide" style={{ color: '#c9c9c9' }}>
        {message}
      </p>
      <p className="mt-1.5 text-xs tracking-widest uppercase" style={{ color: '#666666' }}>
        Flow Notes
      </p>
    </div>
  );
}

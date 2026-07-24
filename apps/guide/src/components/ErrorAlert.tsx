export function ErrorAlert({
  error,
  className = '',
}: {
  error: string | null;
  className?: string;
}) {
  if (!error) return null;
  return (
    <div
      className={`rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger ${className}`}
    >
      {error}
    </div>
  );
}

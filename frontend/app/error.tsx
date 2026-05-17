"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg border border-red-500/60 bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Command center hit an error</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Unexpected issue loading this screen."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

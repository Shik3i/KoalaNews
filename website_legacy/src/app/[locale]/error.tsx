'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  const isDeploymentError =
    error.message?.includes('Server Action') ||
    error.message?.includes('deployment');

  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <p className="text-sm font-medium text-red-500 mb-2">
        {isDeploymentError ? 'Update' : 'Error'}
      </p>
      <h1 className="text-2xl font-bold mb-3">
        {isDeploymentError ? 'App was updated' : 'Something went wrong!'}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        {isDeploymentError
          ? 'The application has been updated in the background. Please refresh the page to continue.'
          : 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex justify-center gap-4">
        {isDeploymentError ? (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            Refresh Page
          </button>
        ) : (
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            Try again
          </button>
        )}
      </div>
    </main>
  );
}

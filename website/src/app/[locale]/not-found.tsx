import { Link } from '@/i18n/navigation';

export default function LocaleNotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <p className="text-sm font-medium text-gray-400 mb-2">404</p>
      <h1 className="text-2xl font-bold mb-3">Not found</h1>
      <p className="text-gray-500 mb-6">This page does not exist or is not available.</p>
      <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
        Back to KoalaNews
      </Link>
    </main>
  );
}

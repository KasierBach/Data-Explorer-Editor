import { Helmet } from 'react-helmet-async';

export function NotFoundPage() {
    return <><Helmet><title>Page not found | Data Explorer</title><meta name="robots" content="noindex, follow" /></Helmet><main className="min-h-screen grid place-items-center bg-background text-foreground p-8"><div className="text-center"><p className="text-muted-foreground">404</p><h1 className="text-3xl font-bold mt-4">Page not found</h1><p className="text-muted-foreground mt-4">This URL does not point to a page in Data Explorer.</p><a href="/" className="inline-block mt-6 text-blue-500">Back to Data Explorer</a></div></main></>;
}

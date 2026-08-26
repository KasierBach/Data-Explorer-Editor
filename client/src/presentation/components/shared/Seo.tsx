import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  lang?: string;
  siteName?: string;
  robots?: string;
}

export function SEO({
  title = 'Data Explorer - Multi-Engine Database Workspace',
  description = 'A unified workspace for PostgreSQL, MySQL, SQL Server, and MongoDB with AI-assisted querying, schema exploration, ERD tools, and team-aware access controls.',
  keywords = 'database workspace, database client, sql editor, nosql explorer, mongodb gui, postgresql client, ai sql assistant, erd diagram, database management',
  ogImage = 'https://data-explorer-editor.vercel.app/og-image.png',
  ogUrl = 'https://data-explorer-editor.vercel.app',
  lang = 'en',
  siteName = 'Data Explorer',
  robots = 'index, follow',
}: SeoProps) {
  const siteTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteName,
    operatingSystem: 'Windows, MacOS, Linux',
    applicationCategory: 'DeveloperApplication',
    description,
    screenshot: ogImage,
    url: ogUrl,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: ogUrl,
    inLanguage: lang,
  };

  return (
    <Helmet htmlAttributes={{ lang }}>
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={siteName} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={ogUrl} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={ogUrl} />

      <script type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
    </Helmet>
  );
}

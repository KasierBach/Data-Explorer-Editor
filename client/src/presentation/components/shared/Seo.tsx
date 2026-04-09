import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  lang?: string;
  siteName?: string;
}

export function SEO({
  title = "Data Explorer - Multi-Engine Database IDE & AI Assistant",
  description = "A unified workspace for PostgreSQL, MySQL, SQL Server, and MongoDB. Experience seamless querying with Gemini 3.1 AI, visual ERD generation, and RBAC security.",
  keywords = "database client, sql tool, nosql gui, mongodb explorer, postgresql client, ai database assistant, text to sql, gemini 3.1, erd diagram generator, database management",
  ogImage = "https://data-explorer-editor.vercel.app/og-image.png",
  ogUrl = "https://data-explorer-editor.vercel.app",
  lang = "en",
  siteName = "Data Explorer"
}: SeoProps) {
  const siteTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  // Structured Data (JSON-LD)
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": siteName,
    "operatingSystem": "Windows, MacOS, Linux",
    "applicationCategory": "DeveloperApplication",
    "description": description,
    "screenshot": ogImage,
    "url": ogUrl,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "120"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": siteName,
    "url": ogUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${ogUrl}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <Helmet htmlAttributes={{ lang }}>
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={ogUrl} />
      <meta property="twitter:title" content={siteTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />
      
      {/* Search Engine Optimization */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <link rel="canonical" href={ogUrl} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
    </Helmet>
  );
}

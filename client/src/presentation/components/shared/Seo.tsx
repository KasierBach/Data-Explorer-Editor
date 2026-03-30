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
  title = "Data Explorer - Smart Database IDE for Developers",
  description = "Connect, explore and visualize your SQL & NoSQL databases with AI-powered features. The smartest local database explorer.",
  keywords = "database, sql, nosql, mongodb, postgresql, explorer, ai, developer tools",
  ogImage = "https://data-explorer.io/og-image.png",
  ogUrl = "https://data-explorer.io",
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

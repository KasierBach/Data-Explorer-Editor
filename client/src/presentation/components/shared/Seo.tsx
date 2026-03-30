import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  lang?: string;
}

export function SEO({
  title = "Data Explorer - Smart Database IDE for Developers",
  description = "Connect, explore and visualize your SQL & NoSQL databases with AI-powered features. The smartest local database explorer.",
  keywords = "database, sql, nosql, mongodb, postgresql, explorer, ai, developer tools",
  ogImage = "https://data-explorer.io/og-image.png",
  ogUrl = "https://data-explorer.io",
  lang = "en"
}: SeoProps) {
  const siteTitle = title.includes("Data Explorer") ? title : `${title} | Data Explorer`;

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
    </Helmet>
  );
}

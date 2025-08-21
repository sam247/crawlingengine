class SEOValidator {
  constructor() {
    this.rules = {
      critical: this.getCriticalRules(),
      high: this.getHighPriorityRules(),
      medium: this.getMediumPriorityRules(),
      low: this.getLowPriorityRules()
    };
  }

  async validatePage(page, url) {
    const issues = [];
    const metrics = {
      performance: {},
      seo: {},
      accessibility: {},
      technical: {}
    };

    try {
      // Get page content and metadata
      const content = await this.getPageContent(page);
      
      // Run all validation rules
      for (const [severity, ruleSet] of Object.entries(this.rules)) {
        for (const rule of ruleSet) {
          const ruleIssues = await rule(page, content, metrics);
          if (ruleIssues && ruleIssues.length > 0) {
            issues.push(...ruleIssues.map(issue => ({
              ...issue,
              severity,
              url
            })));
          }
        }
      }

      return { issues, metrics };
    } catch (error) {
      console.error('Validation error:', error);
      issues.push({
        type: 'technical',
        severity: 'critical',
        message: 'Page validation failed: ' + error.message,
        url
      });
      return { issues, metrics };
    }
  }

  async getPageContent(page) {
    return {
      title: await page.title(),
      metaTags: await page.$$eval('meta', tags => 
        tags.map(tag => ({
          name: tag.getAttribute('name'),
          property: tag.getAttribute('property'),
          content: tag.getAttribute('content')
        }))
      ),
      headings: await page.$$eval('h1, h2, h3, h4, h5, h6', 
        headings => headings.map(h => ({
          level: parseInt(h.tagName.toLowerCase().replace('h', '')),
          text: h.innerText.trim()
        }))
      ),
      images: await page.$$eval('img', 
        imgs => imgs.map(img => ({
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt'),
          width: img.getAttribute('width'),
          height: img.getAttribute('height')
        }))
      ),
      links: await page.$$eval('a', 
        links => links.map(link => ({
          href: link.href,
          text: link.innerText.trim(),
          isInternal: link.href.startsWith(window.location.origin)
        }))
      ),
      textContent: await page.$eval('body', body => body.innerText)
    };
  }

  getCriticalRules() {
    return [
      // Page Speed Analysis
      async (page) => {
        const performanceMetrics = await page.evaluate(() => {
          const timing = window.performance.timing;
          const loadTime = timing.loadEventEnd - timing.navigationStart;
          const ttfb = timing.responseStart - timing.navigationStart;
          const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
          
          return { loadTime, ttfb, fcp };
        });

        const issues = [];
        if (performanceMetrics.loadTime > 3000) {
          issues.push({
            type: 'performance',
            message: 'Slow page load time',
            details: \`Page takes \${(performanceMetrics.loadTime / 1000).toFixed(2)}s to load. Target: < 3s\`,
            metrics: performanceMetrics
          });
        }
        if (performanceMetrics.ttfb > 600) {
          issues.push({
            type: 'performance',
            message: 'High Time to First Byte (TTFB)',
            details: 'Server response time needs improvement',
            metrics: { ttfb: performanceMetrics.ttfb }
          });
        }
        return issues;
      },

      // JavaScript Issues
      async (page) => {
        const jsIssues = await page.evaluate(() => {
          const issues = [];
          
          // Check for render-blocking JS
          const blockingScripts = document.querySelectorAll('script:not([async]):not([defer])');
          if (blockingScripts.length > 0) {
            issues.push({
              type: 'performance',
              message: 'Render-blocking JavaScript detected',
              details: \`\${blockingScripts.length} scripts may block rendering\`
            });
          }

          // Check for JavaScript errors
          const errors = window.performance.getEntriesByType('error');
          if (errors.length > 0) {
            issues.push({
              type: 'technical',
              message: 'JavaScript runtime errors detected',
              details: \`\${errors.length} JavaScript errors found\`
            });
          }

          return issues;
        });

        return jsIssues;
      },
      // Mobile Responsiveness
      async (page) => {
        const isMobile = await page.evaluate(() => {
          return window.matchMedia('(max-width: 768px)').matches;
        });
        if (!isMobile) {
          return [{
            type: 'technical',
            message: 'Page is not mobile responsive',
            details: 'Implement responsive design for mobile devices'
          }];
        }
      },

      // Core Web Vitals
      async (page) => {
        const vitals = await page.evaluate(() => ({
          cls: window.performance.getEntriesByType('layout-shift'),
          lcp: window.performance.getEntriesByType('largest-contentful-paint'),
          fid: window.performance.getEntriesByType('first-input')
        }));
        
        const issues = [];
        if (vitals.cls.length > 0 && vitals.cls[0].value > 0.1) {
          issues.push({
            type: 'performance',
            message: 'Poor Cumulative Layout Shift (CLS)',
            details: 'Layout shifts may affect user experience'
          });
        }
        return issues;
      },

      // HTTPS Security
      async (page) => {
        const security = await page.evaluate(() => ({
          isHttps: window.location.protocol === 'https:',
          hasMixedContent: document.querySelectorAll('link[href^="http:"], script[src^="http:"], img[src^="http:"]').length > 0
        }));

        const issues = [];
        if (!security.isHttps) {
          issues.push({
            type: 'technical',
            message: 'Site not served over HTTPS',
            details: 'Configure SSL/TLS for secure connections'
          });
        }
        if (security.hasMixedContent) {
          issues.push({
            type: 'technical',
            message: 'Mixed content detected',
            details: 'Replace HTTP resources with HTTPS versions'
          });
        }
        return issues;
      }
    ];
  }

  getHighPriorityRules() {
    return [
      // Site Architecture & Crawlability
      async (page, content) => {
        const issues = [];
        
        // Check robots.txt
        const robotsTxt = await fetch(new URL('/robots.txt', page.url())).catch(() => null);
        if (!robotsTxt) {
          issues.push({
            type: 'technical',
            message: 'Missing robots.txt',
            details: 'Create a robots.txt file to guide search engines'
          });
        }

        // Check sitemap
        const sitemapXml = await fetch(new URL('/sitemap.xml', page.url())).catch(() => null);
        if (!sitemapXml) {
          issues.push({
            type: 'technical',
            message: 'Missing sitemap.xml',
            details: 'Create a sitemap.xml file to help search engines discover your content'
          });
        }

        // Check for canonical tags
        const canonical = await page.$eval('link[rel="canonical"]', el => el.href).catch(() => null);
        if (!canonical) {
          issues.push({
            type: 'seo',
            message: 'Missing canonical tag',
            details: 'Add canonical tags to prevent duplicate content issues'
          });
        }

        return issues;
      },

      // Structured Data & Schema Markup
      async (page) => {
        const schemas = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          return Array.from(scripts).map(script => {
            try {
              return JSON.parse(script.textContent);
            } catch {
              return null;
            }
          }).filter(Boolean);
        });

        const issues = [];
        if (schemas.length === 0) {
          issues.push({
            type: 'seo',
            message: 'Missing structured data',
            details: 'Add relevant schema markup for rich snippets'
          });
        } else {
          // Validate common schema types
          const hasOrganization = schemas.some(s => s['@type'] === 'Organization');
          const hasBreadcrumbs = schemas.some(s => s['@type'] === 'BreadcrumbList');
          
          if (!hasOrganization) {
            issues.push({
              type: 'seo',
              message: 'Missing Organization schema',
              details: 'Add Organization schema for better brand presence'
            });
          }
          if (!hasBreadcrumbs) {
            issues.push({
              type: 'seo',
              message: 'Missing BreadcrumbList schema',
              details: 'Add breadcrumb markup for better navigation structure'
            });
          }
        }
        return issues;
      },
      // Title Tag Optimization
      async (page, content) => {
        const issues = [];
        const title = content.title;
        
        if (!title || title.length < 10) {
          issues.push({
            type: 'seo',
            message: 'Title tag is missing or too short',
            details: 'Add a descriptive title between 50-60 characters'
          });
        } else if (title.length > 60) {
          issues.push({
            type: 'seo',
            message: 'Title tag is too long',
            details: 'Shorten title to 50-60 characters'
          });
        }
        return issues;
      },

      // Meta Description
      async (page, content) => {
        const description = content.metaTags.find(
          tag => tag.name === 'description'
        )?.content;

        if (!description) {
          return [{
            type: 'seo',
            message: 'Meta description is missing',
            details: 'Add a compelling meta description between 120-155 characters'
          }];
        } else if (description.length < 120 || description.length > 155) {
          return [{
            type: 'seo',
            message: 'Meta description length is not optimal',
            details: 'Adjust meta description to be between 120-155 characters'
          }];
        }
      },

      // Heading Structure
      async (page, content) => {
        const issues = [];
        const h1Tags = content.headings.filter(h => h.level === 1);
        
        if (h1Tags.length === 0) {
          issues.push({
            type: 'seo',
            message: 'Missing H1 heading',
            details: 'Add a primary H1 heading to the page'
          });
        } else if (h1Tags.length > 1) {
          issues.push({
            type: 'seo',
            message: 'Multiple H1 headings found',
            details: 'Use only one H1 heading per page'
          });
        }
        return issues;
      }
    ];
  }

  getMediumPriorityRules() {
    return [
      // Content Audit & Duplicate Content
      async (page, content) => {
        const issues = [];
        
        // Content quality checks
        const wordCount = content.textContent.split(/\\s+/).length;
        const paragraphs = await page.$$eval('p', ps => ps.map(p => p.textContent.trim()));
        const headings = content.headings;
        
        // Check content structure
        if (paragraphs.length < 3) {
          issues.push({
            type: 'content',
            message: 'Insufficient content structure',
            details: 'Add more paragraphs to improve readability'
          });
        }

        // Check content-to-HTML ratio
        const htmlSize = await page.evaluate(() => document.documentElement.outerHTML.length);
        const textSize = content.textContent.length;
        const contentRatio = textSize / htmlSize;
        
        if (contentRatio < 0.2) {
          issues.push({
            type: 'content',
            message: 'Low content-to-HTML ratio',
            details: 'Improve content density and reduce unnecessary markup'
          });
        }

        // Check for duplicate content within page
        const duplicateParagraphs = paragraphs.filter((p, i) => 
          p.length > 50 && paragraphs.indexOf(p) !== i
        );
        
        if (duplicateParagraphs.length > 0) {
          issues.push({
            type: 'content',
            message: 'Duplicate content detected',
            details: \`\${duplicateParagraphs.length} paragraphs appear multiple times\`
          });
        }

        return issues;
      },

      // User Experience & Mobile-friendly
      async (page) => {
        const issues = [];
        
        // Check viewport configuration
        const hasViewport = await page.$eval('meta[name="viewport"]', () => true).catch(() => false);
        if (!hasViewport) {
          issues.push({
            type: 'mobile',
            message: 'Missing viewport meta tag',
            details: 'Add viewport meta tag for proper mobile rendering'
          });
        }

        // Check tap targets
        const smallTapTargets = await page.evaluate(() => {
          const interactiveElements = document.querySelectorAll('a, button, input, select, textarea');
          return Array.from(interactiveElements).filter(el => {
            const rect = el.getBoundingClientRect();
            return (rect.width < 48 || rect.height < 48);
          }).length;
        });

        if (smallTapTargets > 0) {
          issues.push({
            type: 'mobile',
            message: 'Small tap targets',
            details: \`\${smallTapTargets} elements are too small for mobile users\`
          });
        }

        // Check font sizes
        const smallFonts = await page.evaluate(() => {
          const textElements = document.querySelectorAll('p, span, div');
          return Array.from(textElements).filter(el => {
            const fontSize = window.getComputedStyle(el).fontSize;
            return parseFloat(fontSize) < 16;
          }).length;
        });

        if (smallFonts > 0) {
          issues.push({
            type: 'mobile',
            message: 'Small font sizes',
            details: \`\${smallFonts} text elements have font size smaller than 16px\`
          });
        }

        return issues;
      },

      // Keyword Analysis
      async (page, content) => {
        const issues = [];
        
        // Extract main keywords
        const text = content.textContent.toLowerCase();
        const words = text.split(/\\W+/).filter(w => w.length > 3);
        const wordFreq = {};
        words.forEach(word => {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        // Check keyword density
        const totalWords = words.length;
        Object.entries(wordFreq)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .forEach(([word, freq]) => {
            const density = (freq / totalWords) * 100;
            if (density > 3) {
              issues.push({
                type: 'content',
                message: 'Keyword stuffing detected',
                details: \`Keyword "\${word}" appears too frequently (\${density.toFixed(1)}%)\`
              });
            }
          });

        // Check keyword presence in important elements
        const mainKeywords = Object.entries(wordFreq)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([word]) => word);

        const title = content.title.toLowerCase();
        const description = content.metaTags
          .find(tag => tag.name === 'description')
          ?.content.toLowerCase();
        const h1 = content.headings
          .find(h => h.level === 1)
          ?.text.toLowerCase();

        mainKeywords.forEach(keyword => {
          if (!title?.includes(keyword) && !description?.includes(keyword) && !h1?.includes(keyword)) {
            issues.push({
              type: 'seo',
              message: 'Main keyword not in key elements',
              details: \`Consider adding "\${keyword}" to title, description, or H1\`
            });
          }
        });

        return issues;
      },
      // Image Optimization
      async (page, content) => {
        const issues = [];
        for (const img of content.images) {
          if (!img.alt) {
            issues.push({
              type: 'accessibility',
              message: 'Image missing alt text',
              details: \`Add alt text to image: \${img.src}\`
            });
          }
          if (!img.width || !img.height) {
            issues.push({
              type: 'performance',
              message: 'Image missing dimensions',
              details: \`Add width and height attributes to prevent layout shift: \${img.src}\`
            });
          }
        }
        return issues;
      },

      // Content Quality
      async (page, content) => {
        const issues = [];
        const wordCount = content.textContent.split(/\\s+/).length;
        
        if (wordCount < 300) {
          issues.push({
            type: 'seo',
            message: 'Thin content',
            details: 'Add more high-quality content (recommended: 300+ words)'
          });
        }
        return issues;
      },

      // Internal Linking
      async (page, content) => {
        const internalLinks = content.links.filter(link => link.isInternal);
        if (internalLinks.length < 3) {
          return [{
            type: 'seo',
            message: 'Few internal links',
            details: 'Add more internal links to improve site structure'
          }];
        }
      }
    ];
  }

  getLowPriorityRules() {
    return [
      // Social Meta Tags
      async (page, content) => {
        const issues = [];
        const hasOgTitle = content.metaTags.some(tag => tag.property === 'og:title');
        const hasOgDescription = content.metaTags.some(tag => tag.property === 'og:description');
        const hasOgImage = content.metaTags.some(tag => tag.property === 'og:image');
        
        if (!hasOgTitle || !hasOgDescription || !hasOgImage) {
          issues.push({
            type: 'seo',
            message: 'Missing social meta tags',
            details: 'Add Open Graph meta tags for better social sharing'
          });
        }
        return issues;
      },

      // URL Structure
      async (page, content) => {
        const url = await page.url();
        if (url.includes('?') || url.includes('#') || /[A-Z]/.test(url)) {
          return [{
            type: 'seo',
            message: 'Non-optimal URL structure',
            details: 'Use clean, lowercase URLs without parameters'
          }];
        }
      },

      // Schema Markup
      async (page) => {
        const hasSchema = await page.evaluate(() => {
          return document.querySelector('script[type="application/ld+json"]') !== null;
        });
        
        if (!hasSchema) {
          return [{
            type: 'seo',
            message: 'Missing schema markup',
            details: 'Add relevant schema markup for rich snippets'
          }];
        }
      }
    ];
  }
}

module.exports = SEOValidator;

import { logger } from "./logger";

export interface ExtractedContent {
  title: string | null;
  imageUrl: string | null;
  description: string | null;
}

export async function extractContent(url: string): Promise<ExtractedContent> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AutoXPoster/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn({ url, status: res.status }, "Failed to fetch URL for extraction");
      return { title: null, imageUrl: null, description: null };
    }

    const html = await res.text();

    const getMetaContent = (name: string): string | null => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1].trim();
      }
      return null;
    };

    const getTitleTag = (): string | null => {
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match?.[1]?.trim() ?? null;
    };

    const title =
      getMetaContent("og:title") ||
      getMetaContent("twitter:title") ||
      getTitleTag();

    const imageUrl =
      getMetaContent("og:image") ||
      getMetaContent("twitter:image") ||
      getMetaContent("twitter:image:src");

    const description =
      getMetaContent("og:description") ||
      getMetaContent("twitter:description") ||
      getMetaContent("description");

    return { title, imageUrl, description };
  } catch (err) {
    logger.warn({ url, err }, "Error extracting content from URL");
    return { title: null, imageUrl: null, description: null };
  }
}

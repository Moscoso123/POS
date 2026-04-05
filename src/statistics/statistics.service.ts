import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaleItem } from '../sales/entities/sale-item.entity';

type LocalSoldProduct = {
  productId: string;
  name: string;
  category: string;
  totalSold: number;
  revenue: number;
};

type PhilippineMarketIndicator = {
  indicatorId: string;
  title: string;
  category: string;
  value: number | null;
  year: string;
  unit: string;
  source: string;
};

type IndicatorStatus = {
  available: boolean;
  source: string | null;
  reason: string | null;
};

type InstagramTrendStatus = {
  available: boolean;
  source: string | null;
  reason: string | null;
};

type InstagramTrendItem = {
  hashtag: string;
  postsAnalyzed: number;
  avgLikes: number;
  avgComments: number;
  engagementScore: number;
  samplePermalink: string | null;
  source: string;
};

type InstagramHashtagSearchResponse = {
  data?: Array<{ id: string }>;
};

type InstagramTopMediaResponse = {
  data?: Array<{
    id: string;
    caption?: string;
    like_count?: number;
    comments_count?: number;
    permalink?: string;
    media_type?: string;
    timestamp?: string;
  }>;
};

type WorldBankEntry = {
  indicator: { id: string; value: string };
  date: string;
  value: number | null;
};

const WB_INDICATORS: Array<{
  id: string;
  label: string;
  category: string;
  unit: string;
}> = [
  { id: 'FP.CPI.TOTL',          label: 'Consumer Price Index',          category: 'Consumer Prices',   unit: 'Index (2010=100)' },
  { id: 'NE.CON.PRVT.KD.ZG',    label: 'Household Consumption Growth',  category: 'Consumer Spending', unit: '% annual growth'  },
  { id: 'NY.GDP.MKTP.KD.ZG',    label: 'Philippine GDP Growth',         category: 'Economic Growth',   unit: '% annual growth'  },
  { id: 'SL.UEM.TOTL.ZS',       label: 'Unemployment Rate',             category: 'Labor Market',      unit: '% of labor force' },
];

const WB_BASE = 'https://api.worldbank.org/v2/country/PH/indicator';

@Injectable()
export class StatisticsService {
  private indicatorCache: { expiresAt: number; indicators: PhilippineMarketIndicator[]; status: IndicatorStatus } | null = null;
  private instagramCache: { expiresAt: number; rows: InstagramTrendItem[]; status: InstagramTrendStatus } | null = null;

  constructor(
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
  ) {}

  async getMarketDemandStats(limit: number) {
    const [topSoldProducts, phMarket, instagramTrend] = await Promise.all([
      this.getTopSoldProducts(limit),
      this.getPhilippineMarketIndicators(),
      this.getInstagramEcommerceTrends(limit),
    ]);

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      topSoldProducts,
      phMarketIndicators: phMarket.indicators,
      indicatorStatus: phMarket.status,
      instagramTrends: instagramTrend.rows,
      instagramTrendStatus: instagramTrend.status,
      summary: {
        topSoldProduct: topSoldProducts[0] || null,
        lowestSoldProduct: topSoldProducts.length > 0 ? topSoldProducts[topSoldProducts.length - 1] : null,
        latestCPI: phMarket.indicators.find((i) => i.indicatorId === 'FP.CPI.TOTL') || null,
        topInstagramTrend: instagramTrend.rows[0] || null,
      },
    };
  }

  private async getTopSoldProducts(limit: number): Promise<LocalSoldProduct[]> {
    const rows = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.product', 'product')
      .leftJoin('item.sale', 'sale')
      .select('product.id', 'productId')
      .addSelect('COALESCE(product.name, :unknownName)', 'name')
      .addSelect("COALESCE(product.category, 'Uncategorized')", 'category')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'totalSold')
      .addSelect('COALESCE(SUM(item.subtotal), 0)', 'revenue')
      .where('sale.paymentStatus = :status', { status: 'completed' })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.category')
      .orderBy('SUM(item.quantity)', 'DESC')
      .addOrderBy('SUM(item.subtotal)', 'DESC')
      .limit(limit)
      .setParameter('unknownName', 'Unknown Product')
      .getRawMany<{
        productId: string;
        name: string;
        category: string;
        totalSold: string;
        revenue: string;
      }>();

    return (rows || []).map((row) => ({
      productId: row.productId,
      name: row.name,
      category: row.category,
      totalSold: Number(row.totalSold || 0),
      revenue: Number(row.revenue || 0),
    }));
  }

  private async getPhilippineMarketIndicators(): Promise<{ indicators: PhilippineMarketIndicator[]; status: IndicatorStatus }> {
    const now = Date.now();
    if (this.indicatorCache && this.indicatorCache.expiresAt > now) {
      return { indicators: this.indicatorCache.indicators, status: this.indicatorCache.status };
    }

    try {
      const results = await Promise.all(
        WB_INDICATORS.map(async (meta) => {
          const url = `${WB_BASE}/${meta.id}?format=json&mrv=1`;
          const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });

          if (!res.ok) return null;

          const json = (await res.json()) as [unknown, WorldBankEntry[]];
          const entry = Array.isArray(json[1]) ? json[1][0] : null;
          if (!entry) return null;

          return {
            indicatorId: meta.id,
            title: meta.label,
            category: meta.category,
            value: entry.value !== null && entry.value !== undefined ? Number(Number(entry.value).toFixed(2)) : null,
            year: entry.date,
            unit: meta.unit,
            source: 'World Bank Open Data',
          } satisfies PhilippineMarketIndicator;
        }),
      );

      const indicators = results.filter((r): r is PhilippineMarketIndicator => r !== null);

      const status: IndicatorStatus = {
        available: indicators.length > 0,
        source: 'World Bank Open Data (api.worldbank.org)',
        reason: indicators.length < WB_INDICATORS.length
          ? `${WB_INDICATORS.length - indicators.length} indicator(s) could not be fetched.`
          : null,
      };

      this.indicatorCache = { expiresAt: now + 10 * 60 * 1000, indicators, status };
      return { indicators, status };
    } catch (error) {
      return {
        indicators: [],
        status: {
          available: false,
          source: 'World Bank Open Data',
          reason: `Failed to reach World Bank API: ${String(error)}`,
        },
      };
    }
  }

  private async getInstagramEcommerceTrends(limit: number): Promise<{ rows: InstagramTrendItem[]; status: InstagramTrendStatus }> {
    const now = Date.now();
    if (this.instagramCache && this.instagramCache.expiresAt > now) {
      return {
        rows: this.instagramCache.rows.slice(0, limit),
        status: this.instagramCache.status,
      };
    }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const graphBase = process.env.INSTAGRAM_GRAPH_BASE || 'https://graph.facebook.com/v19.0';
    const configuredHashtags = (process.env.INSTAGRAM_TREND_HASHTAGS || 'ecommerce,shopping,onlinebusiness,onlineshop,smallbusiness')
      .split(',')
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 8);

    if (!accessToken || !businessAccountId) {
      return {
        rows: [],
        status: {
          available: false,
          source: 'Instagram Graph API',
          reason: 'Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID in environment variables.',
        },
      };
    }

    try {
      const rows = (
        await Promise.all(
          configuredHashtags.map(async (tag) => {
            const searchUrl = `${graphBase}/ig_hashtag_search?user_id=${encodeURIComponent(businessAccountId)}&q=${encodeURIComponent(tag)}&access_token=${encodeURIComponent(accessToken)}`;
            const searchRes = await fetch(searchUrl, { method: 'GET', headers: { Accept: 'application/json' } });
            if (!searchRes.ok) return null;

            const searchJson = (await searchRes.json()) as InstagramHashtagSearchResponse;
            const hashtagId = searchJson.data?.[0]?.id;
            if (!hashtagId) return null;

            const mediaUrl = `${graphBase}/${hashtagId}/top_media?user_id=${encodeURIComponent(businessAccountId)}&fields=id,caption,like_count,comments_count,permalink,media_type,timestamp&limit=20&access_token=${encodeURIComponent(accessToken)}`;
            const mediaRes = await fetch(mediaUrl, { method: 'GET', headers: { Accept: 'application/json' } });
            if (!mediaRes.ok) return null;

            const mediaJson = (await mediaRes.json()) as InstagramTopMediaResponse;
            const media = (mediaJson.data || []).filter((m) => m.media_type !== 'STORY');
            if (!media.length) return null;

            const totalLikes = media.reduce((sum, m) => sum + Number(m.like_count || 0), 0);
            const totalComments = media.reduce((sum, m) => sum + Number(m.comments_count || 0), 0);
            const avgLikes = totalLikes / media.length;
            const avgComments = totalComments / media.length;
            const engagementScore = Number((avgLikes + avgComments * 2).toFixed(2));

            return {
              hashtag: `#${tag}`,
              postsAnalyzed: media.length,
              avgLikes: Number(avgLikes.toFixed(2)),
              avgComments: Number(avgComments.toFixed(2)),
              engagementScore,
              samplePermalink: media[0]?.permalink || null,
              source: 'Instagram Graph API',
            } satisfies InstagramTrendItem;
          }),
        )
      )
        .filter((row): row is InstagramTrendItem => row !== null)
        .sort((a, b) => b.engagementScore - a.engagementScore);

      const status: InstagramTrendStatus = {
        available: rows.length > 0,
        source: 'Instagram Graph API',
        reason: rows.length ? null : 'Instagram API returned no trend rows for the configured hashtags.',
      };

      this.instagramCache = {
        rows,
        status,
        expiresAt: now + 10 * 60 * 1000,
      };

      return {
        rows: rows.slice(0, limit),
        status,
      };
    } catch (error) {
      return {
        rows: [],
        status: {
          available: false,
          source: 'Instagram Graph API',
          reason: `Failed to fetch Instagram trends: ${String(error)}`,
        },
      };
    }
  }
}

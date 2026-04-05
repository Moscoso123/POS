import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('assistant')
  async assistantInsights(
    @Request() req,
    @Body() body: { query?: string; message?: string },
  ) {
    const query = (body?.query || body?.message || '').trim();
    const insights = await this.analyticsService.getAiInsights(query);

    return {
      success: true,
      user: {
        id: req.user?.id || req.user?.userId || null,
        role: req.user?.userType || null,
      },
      data: insights,
    };
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateProductReservationDto } from './dto/create-product-reservation.dto';
import { UpdateProductReservationStatusDto } from './dto/update-product-reservation-status.dto';
import { ProductReservationStatus } from './entities/product-reservation.entity';
import { ProductReservationsService } from './product-reservations.service';

@Controller('product-reservations')
@UseGuards(JwtAuthGuard)
export class ProductReservationsController {
  constructor(private readonly productReservationsService: ProductReservationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('client')
  create(@Request() req, @Body() dto: CreateProductReservationDto) {
    return this.productReservationsService.create(req.user.userId, req.user.name, dto);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('client')
  findMine(@Request() req) {
    return this.productReservationsService.findMine(req.user.userId);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('admin')
  findForAdmin(@Query('status') status?: ProductReservationStatus) {
    return this.productReservationsService.findForAdmin(status);
  }

  @Get('admin/pending-count')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getPendingCount() {
    return this.productReservationsService.getPendingCount();
  }

  @Patch('admin/:id/review')
  @UseGuards(RolesGuard)
  @Roles('admin')
  review(@Request() req, @Param('id') id: string, @Body() dto: UpdateProductReservationStatusDto) {
    return this.productReservationsService.updateStatus(id, req.user.userId, req.user.name, dto);
  }
}

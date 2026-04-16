import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/products.entity';
import { CreateProductReservationDto } from './dto/create-product-reservation.dto';
import { UpdateProductReservationStatusDto } from './dto/update-product-reservation-status.dto';
import { ProductReservation, ProductReservationStatus } from './entities/product-reservation.entity';

@Injectable()
export class ProductReservationsService {
  constructor(
    @InjectRepository(ProductReservation)
    private reservationRepository: Repository<ProductReservation>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(clientId: string, clientName: string, dto: CreateProductReservationDto) {
    const product = await this.productRepository.findOne({ where: { id: dto.productId } });
    if (!product || product.is_active === false) {
      throw new NotFoundException('Product not found');
    }

    if (Number(product.stock_quantity || 0) < dto.quantity) {
      throw new BadRequestException('Requested quantity exceeds available stock');
    }

    const reservation = this.reservationRepository.create({
      productId: product.id,
      productName: product.name,
      clientId,
      clientName,
      quantity: dto.quantity,
      note: dto.note?.trim() || null,
      status: ProductReservationStatus.PENDING,
      reviewedById: null,
      reviewedByName: null,
      adminNote: null,
    });

    const saved = await this.reservationRepository.save(reservation);

    return {
      success: true,
      message: 'Product reservation submitted. Waiting for admin approval.',
      data: saved,
      adminNotification: {
        type: 'PRODUCT_RESERVATION_PENDING',
        reservationId: saved.id,
      },
    };
  }

  async findMine(clientId: string) {
    const items = await this.reservationRepository.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: items,
    };
  }

  async findForAdmin(status?: ProductReservationStatus) {
    const where = status ? { status } : {};
    const items = await this.reservationRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: items,
    };
  }

  async getPendingCount() {
    const count = await this.reservationRepository.count({
      where: { status: ProductReservationStatus.PENDING },
    });

    return {
      success: true,
      data: { count },
    };
  }

  async updateStatus(reservationId: string, reviewerId: string, reviewerName: string, dto: UpdateProductReservationStatusDto) {
    const reservation = await this.reservationRepository.findOne({ where: { id: reservationId } });

    if (!reservation) {
      throw new NotFoundException('Reservation request not found');
    }

    if (reservation.status !== ProductReservationStatus.PENDING) {
      throw new BadRequestException('Only pending reservations can be reviewed');
    }

    if (dto.status === ProductReservationStatus.PENDING) {
      throw new BadRequestException('Status must be approved or rejected');
    }

    if (dto.status === ProductReservationStatus.APPROVED) {
      const product = await this.productRepository.findOne({ where: { id: reservation.productId } });
      if (!product || product.is_active === false) {
        throw new BadRequestException('Cannot approve. Product is unavailable');
      }

      if (Number(product.stock_quantity || 0) < reservation.quantity) {
        throw new BadRequestException('Cannot approve. Insufficient stock');
      }

      product.stock_quantity = Number(product.stock_quantity || 0) - reservation.quantity;
      await this.productRepository.save(product);
    }

    reservation.status = dto.status;
    reservation.reviewedById = reviewerId;
    reservation.reviewedByName = reviewerName;
    reservation.adminNote = dto.adminNote?.trim() || null;

    const saved = await this.reservationRepository.save(reservation);

    return {
      success: true,
      message: `Reservation ${dto.status} successfully`,
      data: saved,
    };
  }
}

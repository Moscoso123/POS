import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() createExpenseDto: CreateExpenseDto, @Request() req) {
    return this.expensesService.create(createExpenseDto, req.user.userId);
  }

  @Get()
  findRecent(@Query('limit') limit = 10) {
    return this.expensesService.findRecent(+limit);
  }

  @Get('summary')
  getSummary(@Query('limit') limit = 8, @Query('startDate') startDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    return this.expensesService.getSummary(+limit, start);
  }

  @Get('daily')
  getDaily(@Query('days') days = 14) {
    return this.expensesService.getDailyExpenses(+days);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto) {
    return this.expensesService.update(id, updateExpenseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }

  @Post('reset-all')
  @UseGuards(RolesGuard)
  @Roles('admin')
  resetAll() {
    return this.expensesService.resetAll();
  }
}
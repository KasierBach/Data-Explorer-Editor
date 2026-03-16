import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { OnboardingDto } from './dto/onboarding.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    async getProfile(@Request() req: any) {
        return this.usersService.findById(req.user.id);
    }

    @Patch('profile/onboarding')
    async onboarding(@Request() req: any, @Body() dto: OnboardingDto) {
        return this.usersService.onboarding(req.user.id, dto);
    }

    @Get()
    @Roles('admin')
    async findAll() {
        return this.usersService.findAll();
    }

    @Post(':id/reset-password')
    @Roles('admin')
    async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
        return this.usersService.resetPassword(id, dto);
    }

    @Patch(':id/role')
    @Roles('admin')
    async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
        return this.usersService.updateRole(id, dto);
    }
}

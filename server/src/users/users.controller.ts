import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';

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

    @Patch('profile')
    async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
        return this.usersService.updateProfile(req.user.id, dto);
    }

    @Patch('settings')
    async updateSettings(@Request() req: any, @Body() dto: UpdateSettingsDto) {
        return this.usersService.updateSettings(req.user.id, dto);
    }

    @Patch('billing')
    async updateBilling(@Request() req: any, @Body() dto: UpdateBillingDto) {
        return this.usersService.updateBilling(req.user.id, dto);
    }

    @Post('change-password')
    async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
        return this.usersService.changePassword(req.user.id, dto);
    }

    @Delete('me')
    async deleteAccount(@Request() req: any) {
        return this.usersService.deleteAccount(req.user.id);
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

    @Delete(':id')
    @Roles('admin')
    async deleteUser(@Param('id') id: string) {
        return this.usersService.deleteAccount(id);
    }

    @Patch(':id/ban')
    @Roles('admin')
    async toggleBan(@Param('id') id: string) {
        return this.usersService.toggleBan(id);
    }
}

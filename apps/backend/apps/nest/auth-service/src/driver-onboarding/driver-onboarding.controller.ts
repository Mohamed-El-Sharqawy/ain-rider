import {
  Controller,
  Patch,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  Param,
} from "@nestjs/common";
import { InternalAuthGuard } from "../auth/guards/internal-auth.guard";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { DriverOnboardingService } from "./driver-onboarding.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DriverGuard } from "../auth/guards/driver.guard";
import { UpdateDriverProfileDto } from "./dto/update-driver-profile.dto";
import { UpdateOnlineStatusDto } from "./dto/update-online-status.dto";

@ApiTags("Driver Onboarding")
@Controller("auth/driver")
export class DriverOnboardingController {
  constructor(private readonly service: DriverOnboardingService) {}

  @Patch("profile")
  @UseGuards(JwtAuthGuard, DriverGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update driver profile (non-critical fields)" })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    const result = await this.service.updateDriverProfile(req.user.id, dto);
    return { success: true, data: result };
  }

  @Patch("status")
  @UseGuards(JwtAuthGuard, DriverGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Toggle driver online/searching status" })
  async updateStatus(@Request() req: any, @Body() dto: UpdateOnlineStatusDto) {
    const result = await this.service.updateOnlineStatus(
      req.user.id,
      dto.isOnline,
    );
    return { success: true, data: result };
  }

  @Post("documents/identity")
  @UseGuards(JwtAuthGuard, DriverGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload identity documents (3 images required)" })
  async uploadIdentityDocuments(@Request() req: FastifyRequest) {
    console.log("[DriverOnboarding] uploadIdentityDocuments called");
    const processedFiles: any[] = [];
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        console.log(`[DriverOnboarding] Received file: ${part.filename}, size: ${buffer.length}`);
        processedFiles.push({
          buffer,
          originalname: part.filename,
          mimetype: part.mimetype,
          size: buffer.length,
          fieldname: part.fieldname,
        });
      }
    }

    if (processedFiles.length !== 3) {
      throw new BadRequestException("Exactly 3 identity images are required");
    }

    const result = await (this.service as any).uploadIdentityDocuments(
      (req as any).user.id,
      processedFiles,
    );
    return { success: true, data: result };
  }

  @Post("documents/driving-license")
  @UseGuards(JwtAuthGuard, DriverGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload driving license (2 images required)" })
  async uploadDrivingLicense(@Request() req: FastifyRequest) {
    console.log("[DriverOnboarding] uploadDrivingLicense called");
    const processedFiles: any[] = [];
    const fields: Record<string, string> = {};
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        console.log(`[DriverOnboarding] Received license file: ${part.filename}, size: ${buffer.length}`);
        processedFiles.push({
          buffer,
          originalname: part.filename,
          mimetype: part.mimetype,
          size: buffer.length,
          fieldname: part.fieldname,
        });
      } else if (part.type === "field") {
        fields[(part as any).fieldname] = (part as any).value;
      }
    }

    if (processedFiles.length !== 2) {
      throw new BadRequestException(
        "Exactly 2 driving license images are required",
      );
    }

    const licenseNumber = fields["licenseNumber"];
    if (!licenseNumber || licenseNumber.trim() === "") {
      throw new BadRequestException("License number is required");
    }

    const result = await (this.service as any).uploadDrivingLicense(
      (req as any).user.id,
      processedFiles,
      licenseNumber,
    );
    return { success: true, data: result };
  }

  @Post("vehicle")
  @UseGuards(JwtAuthGuard, DriverGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Register vehicle with images" })
  async registerVehicle(@Request() req: FastifyRequest) {
    console.log("[DriverOnboarding] registerVehicle called");
    const processedFiles: any[] = [];
    const fields: Record<string, string> = {};
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        console.log(`[DriverOnboarding] Received vehicle file: ${part.filename}, size: ${buffer.length}`);
        processedFiles.push({
          buffer,
          originalname: part.filename,
          mimetype: part.mimetype,
          size: buffer.length,
          fieldname: part.fieldname,
        });
      } else if (part.type === "field") {
        fields[(part as any).fieldname] = (part as any).value;
      }
    }

    const carImage = processedFiles.find((f) => f.fieldname === "carImage");
    const carLicenseImage = processedFiles.find((f) => f.fieldname === "carLicenseImage");

    if (!carImage || !carLicenseImage) {
      throw new BadRequestException(
        "Both carImage and carLicenseImage are required",
      );
    }

    const result = await (this.service as any).registerVehicle(
      (req as any).user.id,
      {
        make: fields["make"],
        model: fields["model"],
        year: parseInt(fields["year"], 10),
        color: fields["color"],
        plateNumber: fields["plateNumber"],
      },
      carImage,
      carLicenseImage,
    );
    return { success: true, data: result };
  }

  @Get("onboarding-status")
  @UseGuards(JwtAuthGuard, DriverGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get driver onboarding status" })
  async getOnboardingStatus(@Request() req: any) {
    const result = await this.service.getOnboardingStatus(req.user.id);
    return { success: true, data: result };
  }

  @Get(":userId/onboarding-status")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth('internal-secret')
  @ApiOperation({ summary: "Get driver onboarding status by user ID (Admin only)" })
  async getOnboardingStatusById(@Param("userId") userId: string) {
    const result = await this.service.getOnboardingStatus(userId);
    return { success: true, data: result };
  }

  @Patch(":userId/reset-attempts")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth('internal-secret')
  @ApiOperation({ summary: "Reset driver document upload attempts (Admin only)" })
  async resetUploadAttempts(@Param("userId") userId: string) {
    await this.service.resetUploadAttempts(userId);
    return { success: true, message: "Upload attempts reset successfully" };
  }
}

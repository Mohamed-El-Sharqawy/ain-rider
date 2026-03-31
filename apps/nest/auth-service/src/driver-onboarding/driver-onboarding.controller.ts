import {
  Controller,
  Patch,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
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

interface FastifyFile {
  type: "file";
  toBuffer: () => Promise<Buffer>;
  filename: string;
  encoding: string;
  mimetype: string;
  fieldname: string;
}

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
    const files: FastifyFile[] = [];
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "file") {
        files.push(part as FastifyFile);
      }
    }

    if (files.length !== 3) {
      throw new BadRequestException("Exactly 3 identity images are required");
    }

    const processedFiles = await Promise.all(
      files.map(async (f) => ({
        buffer: await f.toBuffer(),
        originalname: f.filename,
        mimetype: f.mimetype,
        size: (await f.toBuffer()).length,
        fieldname: f.fieldname,
      })),
    );

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
    const files: FastifyFile[] = [];
    const fields: Record<string, string> = {};
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "file") {
        files.push(part as FastifyFile);
      } else if (part.type === "field") {
        fields[(part as any).fieldname] = (part as any).value;
      }
    }

    if (files.length !== 2) {
      throw new BadRequestException(
        "Exactly 2 driving license images are required",
      );
    }

    const licenseNumber = fields["licenseNumber"];
    if (!licenseNumber || licenseNumber.trim() === "") {
      throw new BadRequestException("License number is required");
    }

    const processedFiles = await Promise.all(
      files.map(async (f) => ({
        buffer: await f.toBuffer(),
        originalname: f.filename,
        mimetype: f.mimetype,
        size: (await f.toBuffer()).length,
        fieldname: f.fieldname,
      })),
    );

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
  async registerVehicle(@Request() req: FastifyRequest, @Body() body: any) {
    const files: FastifyFile[] = [];
    const fields: Record<string, string> = {};
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "file") {
        files.push(part as FastifyFile);
      } else if (part.type === "field") {
        fields[(part as any).fieldname] = (part as any).value;
      }
    }

    const carImageFile = files.find((f) => f.fieldname === "carImage");
    const carLicenseFile = files.find((f) => f.fieldname === "carLicenseImage");

    if (!carImageFile || !carLicenseFile) {
      throw new BadRequestException(
        "Both carImage and carLicenseImage are required",
      );
    }

    const carImage = {
      buffer: await carImageFile.toBuffer(),
      originalname: carImageFile.filename,
      mimetype: carImageFile.mimetype,
      size: (await carImageFile.toBuffer()).length,
    };

    const carLicenseImage = {
      buffer: await carLicenseFile.toBuffer(),
      originalname: carLicenseFile.filename,
      mimetype: carLicenseFile.mimetype,
      size: (await carLicenseFile.toBuffer()).length,
    };

    const result = await (this.service as any).registerVehicle(
      (req as any).user.id,
      {
        make: fields["make"] || body?.make,
        model: fields["model"] || body?.model,
        year: parseInt(fields["year"] || body?.year, 10),
        color: fields["color"] || body?.color,
        plateNumber: fields["plateNumber"] || body?.plateNumber,
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
}

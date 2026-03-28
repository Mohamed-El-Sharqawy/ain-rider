import { Controller, Patch, UseGuards, Request } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { RiderProfileService } from "./rider-profile.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RiderGuard } from "../auth/guards/rider.guard";

interface FastifyFile {
  type: "file";
  toBuffer: () => Promise<Buffer>;
  filename: string;
  encoding: string;
  mimetype: string;
  fieldname: string;
}

@ApiTags("Rider Profile")
@Controller("auth/rider")
export class RiderProfileController {
  constructor(private readonly service: RiderProfileService) {}

  @Patch("profile/image")
  @UseGuards(JwtAuthGuard, RiderGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload rider profile image" })
  async uploadProfileImage(@Request() req: FastifyRequest) {
    let imageFile: FastifyFile | null = null;
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "file") {
        imageFile = part as FastifyFile;
        break;
      }
    }

    if (!imageFile) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Image file is required" },
      };
    }

    const file = {
      buffer: await imageFile.toBuffer(),
      originalname: imageFile.filename,
      mimetype: imageFile.mimetype,
      size: (await imageFile.toBuffer()).length,
    };

    const result = await this.service.uploadProfileImage(
      (req as any).user.sub,
      file,
    );
    return { success: true, data: result };
  }
}

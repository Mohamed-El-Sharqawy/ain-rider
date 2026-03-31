import { Controller, Patch, Post, UseGuards, Request, BadRequestException } from "@nestjs/common";
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
      (req as any).user.id,
      file,
    );
    return { success: true, data: result };
  }

  @Post("documents/identity")
  @UseGuards(JwtAuthGuard, RiderGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload rider identity documents (front and back of ID card)" })
  async uploadIdentityDocuments(@Request() req: FastifyRequest) {
    console.log("[RiderProfile] uploadIdentityDocuments called");
    
    // Get userId before consuming body (saveRequestFiles may interfere)
    const userId = (req as any).user?.id;
    console.log("[RiderProfile] userId:", userId);
    
    if (!userId) {
      throw new BadRequestException("User not authenticated");
    }
    
    // Use saveRequestFiles which handles stream consumption properly
    const files = await (req as any).saveRequestFiles();
    console.log("[RiderProfile] Files saved:", files.length);
    
    const frontFile = files.find((f: any) => f.fieldname === "identityFront");
    const backFile = files.find((f: any) => f.fieldname === "identityBack");

    if (!frontFile || !backFile) {
      throw new BadRequestException(
        "Both identityFront and identityBack files are required",
      );
    }

    // Read file contents from temp paths
    const fs = await import("fs/promises");
    const frontBuffer = await fs.readFile(frontFile.filepath);
    const backBuffer = await fs.readFile(backFile.filepath);

    const front = {
      buffer: frontBuffer,
      originalname: frontFile.filename,
      mimetype: frontFile.mimetype,
      size: frontBuffer.length,
    };

    const back = {
      buffer: backBuffer,
      originalname: backFile.filename,
      mimetype: backFile.mimetype,
      size: backBuffer.length,
    };

    const result = await this.service.uploadIdentityDocuments(
      userId,
      front,
      back,
    );
    
    // Clean up temp files
    await Promise.all(files.map((f: any) => fs.unlink(f.filepath).catch(() => {})));
    
    console.log("[RiderProfile] Upload complete");
    return { success: true, data: result };
  }
}

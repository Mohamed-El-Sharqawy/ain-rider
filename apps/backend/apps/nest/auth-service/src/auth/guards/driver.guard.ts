import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class DriverGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== "DRIVER") {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "This action is only available for drivers",
        },
      });
    }

    return true;
  }
}

export const JwtDriverGuard = AuthGuard("jwt");

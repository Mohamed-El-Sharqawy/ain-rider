import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class RiderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== "RIDER") {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "This action is only available for riders",
        },
      });
    }

    return true;
  }
}

export const JwtRiderGuard = AuthGuard("jwt");

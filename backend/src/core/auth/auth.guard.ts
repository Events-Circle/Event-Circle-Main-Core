import { Injectable, CanActivate, ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthService } from './auth.service.js';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.identity = await this.auth.authenticate(request.headers.authorization);
    return true;
  }
}
export const Actor = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest().identity,
);

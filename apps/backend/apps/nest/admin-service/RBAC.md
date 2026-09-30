# Admin Service - Role-Based Access Control (RBAC)

## Roles

- **ADMIN**: Full access to all endpoints, can modify system settings and approve financial operations
- **SUPPORT**: Limited access for customer support operations, cannot modify system settings or approve withdrawals

## Access Control Matrix

### Settings (`/settings`)
| Endpoint | Method | ADMIN | SUPPORT |
|----------|--------|-------|---------|
| Get all settings | GET `/settings` | ✅ | ❌ |
| Get setting by key | GET `/settings/:key` | ✅ | ❌ |
| Update setting | PUT `/settings/:key` | ✅ | ❌ |

**Rationale**: Only admins should modify system-wide configuration.

---

### Wallets (`/wallets`)
| Endpoint | Method | ADMIN | SUPPORT |
|----------|--------|-------|---------|
| Get user wallet | GET `/wallets/user/:userId` | ✅ | ✅ |
| Credit wallet | POST `/wallets/credit` | ✅ | ✅ |
| Debit wallet | POST `/wallets/debit` | ✅ | ✅ |
| Get withdrawals | GET `/withdrawals` | ✅ | ✅ |
| **Process withdrawal** | PATCH `/withdrawals/:id/process` | ✅ | ❌ |

**Rationale**: Support can view and manage wallets, but only admins can approve/reject withdrawal requests (financial authority).

---

### Promos (`/promos`)
| Endpoint | Method | ADMIN | SUPPORT |
|----------|--------|-------|---------|
| Get all promos | GET `/promos` | ✅ | ✅ |
| Validate promo | GET `/promos/validate` | ✅ | ✅ |
| Get promo by code | GET `/promos/:code` | ✅ | ✅ |
| **Create promo** | POST `/promos` | ✅ | ❌ |
| **Update promo** | PATCH `/promos/:id` | ✅ | ❌ |

**Rationale**: Support can view and validate promos, but only admins can create/modify promotional campaigns.

---

### Vehicles (`/vehicles`, `/vehicle-types`)
| Endpoint | Method | ADMIN | SUPPORT |
|----------|--------|-------|---------|
| Get all vehicle types | GET `/vehicle-types` | ✅ | ✅ |
| **Create vehicle type** | POST `/vehicle-types` | ✅ | ❌ |
| **Update vehicle type** | PATCH `/vehicle-types/:id` | ✅ | ❌ |
| Get all vehicles | GET `/vehicles` | ✅ | ✅ |
| Create vehicle | POST `/vehicles` | ✅ | ✅ |
| Update vehicle | PATCH `/vehicles/:id` | ✅ | ✅ |

**Rationale**: Support can manage individual vehicle registrations, but only admins can modify vehicle type definitions (pricing, capacity, etc.).

---

### Notifications (`/notifications`)
| Endpoint | Method | ADMIN | SUPPORT |
|----------|--------|-------|---------|
| Create notification | POST `/notifications` | ✅ | ✅ |
| Get user notifications | GET `/notifications/user/:userId` | ✅ | ✅ |
| Mark as read | PATCH `/notifications/:id/read` | ✅ | ✅ |

**Rationale**: Both roles can send notifications to users for customer support purposes.

---

### Complaints (`/complaints`)
| Endpoint | Method | ADMIN | SUPPORT |
|----------|--------|-------|---------|
| Get all complaints | GET `/complaints` | ✅ | ✅ |
| Get complaint by ID | GET `/complaints/:id` | ✅ | ✅ |
| Create complaint | POST `/complaints` | ✅ | ✅ |
| Update complaint status | PATCH `/complaints/:id/status` | ✅ | ✅ |
| Add comment | POST `/complaints/:id/comments` | ✅ | ✅ |

**Rationale**: Both roles can handle customer complaints and support tickets.

---

## Implementation

### Guards
- **`AdminGuard`**: Validates JWT token and checks if user has `ADMIN` or `SUPPORT` role
- **`RolesGuard`**: Checks if user's role matches the required role(s) specified by `@Roles()` decorator

### Usage Example

```typescript
// Controller-level: All endpoints require ADMIN role
@UseGuards(AdminGuard, RolesGuard)
@Roles('ADMIN')
@Controller('settings')
export class SettingsController {}

// Method-level: Specific endpoint requires ADMIN role
@UseGuards(AdminGuard, RolesGuard)
@Controller('wallets')
export class WalletsController {
  @Get('withdrawals')  // Both ADMIN and SUPPORT can view
  findWithdrawals() {}

  @Roles('ADMIN')  // Only ADMIN can process
  @Patch('withdrawals/:id/process')
  processWithdrawal() {}
}
```

## Seeding Users

Run the seed script to create both ADMIN and SUPPORT users:

```bash
pnpm --filter @ain-rider/auth-service prisma:seed
```

**Default credentials** (change in production):
- **Admin**: `admin@ainrider.com` / `Admin@1234`
- **Support**: `support@ainrider.com` / `Support@1234`

Configure via `.env`:
```env
ADMIN_EMAIL=admin@ainrider.com
ADMIN_PASSWORD=Admin@1234
SUPPORT_EMAIL=support@ainrider.com
SUPPORT_PASSWORD=Support@1234
```

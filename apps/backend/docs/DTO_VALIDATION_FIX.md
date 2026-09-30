# DTO Validation Fix

## Problem
All NestJS services were experiencing validation errors because:
1. Controllers used `@Body() body: any` or inline object types
2. DTOs lacked `class-validator` decorators
3. ValidationPipe couldn't validate request bodies

This caused 401/500 errors on endpoints like `/admin/complaints`, `/admin/promos`, `/admin/withdrawals`.

## Solution
Added proper DTOs with `class-validator` decorators across all NestJS services.

---

## Admin Service (`admin-service`)

### Complaints Module
- `dto/create-complaint.dto.ts` - `@IsUUID`, `@IsEnum`, `@IsString` for all fields
- `dto/update-complaint-status.dto.ts` - Status enum validation
- `dto/add-comment.dto.ts` - Comment validation with optional `isInternal`

### Promos Module
- `dto/create-promo.dto.ts` - Full validation with `@Min`, `@IsDateString`, enums for type
- `dto/update-promo.dto.ts` - Optional fields for status and limits

### Vehicles Module
- `dto/create-vehicle-type.dto.ts` - Pricing validation with `@Min`, `@IsInt`
- `dto/update-vehicle-type.dto.ts` - Optional updates
- `dto/create-vehicle.dto.ts` - Vehicle registration with year range validation
- `dto/update-vehicle.dto.ts` - Optional vehicle updates

### Wallets Module
- `dto/credit-debit-wallet.dto.ts` - Amount validation with `@Min(0.01)`
- `dto/process-withdrawal.dto.ts` - Approval/rejection with `processedBy` UUID

### Notifications Module
- `dto/create-notification.dto.ts` - Full notification validation
- `dto/send-push.dto.ts` - Push notification fields
- `dto/send-sms.dto.ts` - SMS validation

### Settings Module
- `dto/upsert-setting.dto.ts` - Settings with type enum validation

### Auth Module
- `current-user.decorator.ts` - Created decorator for extracting authenticated user

---

## Trip Service (`trip-service`)

### Trips Module
- **Updated** `dto/create-trip.dto.ts` - Added validators:
  - Lat/Lng range validation (`@Min(-90)`, `@Max(90)`, etc.)
  - `@IsUUID` for `riderId`
  - `@IsEnum` for `paymentMethod`
  - `@Min(0)` for `estimatedFare`
- **Created** `dto/update-trip-status.dto.ts` - Status enum with optional `driverId`
- **Created** `dto/rate-trip.dto.ts` - Rating validation (1-5 range)
- **Fixed** controller import from `import type` to value import

---

## Payment Service (`payment-service`)

### Payments Module
- **Created** `dto/create-payment.dto.ts`:
  - `@IsUUID` for all ID fields
  - `@IsEnum` for `paymentMethod`
  - `@Min(0)` for amount
- **Created** `dto/create-refund.dto.ts`:
  - `@Min(0.01)` for refund amount
  - `@IsString` for reason

---

## Validation Rules Applied

All DTOs follow these patterns:
- **UUIDs**: `@IsUUID()` for all ID fields
- **Enums**: `@IsEnum([...])` for status, role, type fields
- **Numbers**: `@Min()` / `@Max()` for amounts, coordinates, ratings
- **Strings**: `@IsString()` for text fields
- **Optional**: `@IsOptional()` for nullable fields
- **Swagger**: `@ApiProperty()` / `@ApiPropertyOptional()` for documentation

## Impact
- All request bodies are now validated before reaching service layer
- Clear validation error messages returned to clients
- Type safety enforced at runtime
- Swagger documentation automatically generated from decorators
- Prevents invalid data from reaching database

## Testing
After these changes, all endpoints should:
1. Accept valid requests successfully
2. Return 400 Bad Request with detailed validation errors for invalid data
3. Display proper Swagger documentation at `/api/docs`

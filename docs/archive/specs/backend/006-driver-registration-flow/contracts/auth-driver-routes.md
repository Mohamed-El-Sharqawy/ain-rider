# API Contracts: Driver Registration Routes

Gateway proxy routes for `/auth/driver/*` endpoints.
All routes require `Authorization: Bearer <jwt-token>` header unless noted.

## Routes

### Driver Profile

**PATCH** `/auth/driver/profile`

Update driver profile fields (non-critical).

**Request Body** (JSON):

```json
{
  "address": "123 Main St (8-200 chars, optional)",
  "city": "Erbil (2-100 chars, optional)",
  "state": "Kurdistan (2-100 chars, optional)",
  "country": "Iraq (2-100 chars, optional)",
  "dateOfBirth": "1990-01-15 (ISO 8601 date, optional)",
  "emergencyContactName": "Jane Doe (2-100 chars, optional)",
  "emergencyContactPhone": "+964770123456 (8-15 chars, optional)"
}
```

**Response** (200):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "onboardingStatus": "PENDING_DOCUMENTS",
    "user": {
      "id": "uuid",
      "email": "driver@test.com",
      "phoneNumber": "+1234567890",
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Main St",
      "city": "Erbil",
      "state": "Kurdistan",
      "country": "Iraq",
      "dateOfBirth": "1990-01-15T00:00:00.000Z",
      "emergencyContactName": "Jane Doe",
      "emergencyContactPhone": "+964770123456"
    }
  }
}
```

**Errors**:

- `400` Invalid field values (e.g., bad date format)
- `401` Not authenticated
- `403` User is not a DRIVER role

---

### Upload Identity Documents

**POST** `/auth/driver/documents/identity`

Upload identity verification images (exactly 3).

**Request**: `multipart/form-data`

- 3 file fields, each image (JPEG/PNG/WebP, max 10MB)

**Response** (200):

```json
{
  "success": true,
  "data": {
    "identityImages": [
      {
        "url": "https://minio:9000/ain-rider/drivers/.../photo1.jpg?...",
        "expiresAt": "..."
      },
      {
        "url": "https://minio:9000/ain-rider/drivers/.../photo2.jpg?...",
        "expiresAt": "..."
      },
      {
        "url": "https://minio:9000/ain-rider/drivers/.../photo3.jpg?...",
        "expiresAt": "..."
      }
    ],
    "status": "PENDING",
    "uploadAttempts": 1,
    "onboardingStatus": "PENDING_DOCUMENTS"
  }
}
```

**Errors**:

- `400` Not exactly 3 images provided
- `401` Not authenticated
- `403` User is not a DRIVER role
- `413` File exceeds 10MB
- `415` Unsupported image format
- `429` Maximum upload attempts reached (3/3)

---

### Upload Driving License

**POST** `/auth/driver/documents/driving-license`

Upload driving license images and license number.

**Request**: `multipart/form-data`

- `licenseNumber` field (string, 1-50 chars, required)
- 2 file fields, each image (JPEG/PNG/WebP, max 10MB)

**Response** (200):

```json
{
  "success": true,
  "data": {
    "drivingLicenseImages": [
      {
        "url": "https://minio:9000/ain-rider/drivers/.../license1.jpg?...",
        "expiresAt": "..."
      },
      {
        "url": "https://minio:9000/ain-rider/drivers/.../license2.jpg?...",
        "expiresAt": "..."
      }
    ],
    "status": "PENDING",
    "uploadAttempts": 1,
    "onboardingStatus": "PENDING_DOCUMENTS"
  }
}
```

**Errors**:

- `400` License number is required / Not exactly 2 images
- `401` Not authenticated
- `403` User is not a DRIVER role
- `409` License number already registered to another driver
- `413` File exceeds 10MB
- `415` Unsupported image format
- `429` Maximum upload attempts reached (3/3)

---

### Register Vehicle

**POST** `/auth/driver/vehicle`

Register or update a vehicle.

**Request**: `multipart/form-data`

- `make` field (string, required)
- `model` field (string, required)
- `year` field (integer, currentYear-20 to currentYear+1)
- `color` field (string, required)
- `plateNumber` field (string, format: `[A-Z]{2,3}-[0-9]{4}`)
- `carImage` file (JPEG/PNG/WebP, max 10MB, required)
- `carLicenseImage` file (JPEG/PNG/WebP, max 10MB, required)

- `carLicenseText` field (string, optional)

**Response** (200):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "make": "Toyota",
    "model": " "Camry",
    "year": 2020,
    "color": "White",
    "plateNumber": "AB-1234",
    "carImage": { "url": "https://minio:9000/ain-rider/drivers/.../car.jpg?...", "expiresAt": "..." },
    "carLicenseImage": { "url": "https://minio:9000/ain-rider/drivers/.../carlicense.jpg?...", "expiresAt": "..." },
    "status": "PENDING",
    "onboardingStatus": "UNDER_REVIEW"
  }
}
```

**Errors**:

- `400` Invalid plate number format / Year out of range / Missing required fields
- `401` Not authenticated
- `403` User is not a DRIVER role
- `409` Plate number already registered
- `413` File exceeds 10MB

- `429` Maximum upload attempts reached (3/3)

---

### Update Online Status

**PATCH** `/auth/driver/status`

Toggle driver online status.

**Request Body** (JSON):

```json
{
  "isOnline": true
}
```

**Response** (200):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "isOnline": true,
    "onboardingStatus": "APPROVED"
  }
}
```

**Errors**:

- `400` Only approved drivers can go online
- `401` Not authenticated
- `403` User is not a DRIVER role

---

### Get Onboarding Status

**GET** `/auth/driver/onboarding-status`

Get current onboarding progress.

**Response** (200):

```json
{
  "success": true,
  "data": {
    "onboardingStatus": "PENDING_DOCUMENTS",
    "documents": {
      "identity": {
        "status": "PENDING",
        "uploadAttempts": 0,
        "rejectionReason": null,
        "images": []
      },
      "drivingLicense": {
        "status": "PENDING",
        "uploadAttempts": 0,
        "rejectionReason": null,
        "images": []
      },
      "vehicle": {
        "status": "PENDING",
        "uploadAttempts": 0,
        "rejectionReason": null,
        "carImage": null,
        "carLicenseImage": null
      }
    }
  }
}
```

**When fully uploaded**:

```json
{
  "success": true,
  "data": {
    "onboardingStatus": "UNDER_REVIEW",
    "documents": {
      "identity": {
        "status": "PENDING",
        "uploadAttempts": 1,
        "rejectionReason": null,
        "images": [{ "url": "https://...", "expiresAt": "..." }]
      },
      "drivingLicense": {
        "status": "PENDING",
        "uploadAttempts": 1,
        "rejectionReason": null,
        "images": [{ "url": "https://...", "expiresAt": "..." }]
      },
      "vehicle": {
        "status": "PENDING",
        "uploadAttempts": 1,
        "rejectionReason": null,
        "carImage": { "url": "https://...", "expiresAt": "..." },
        "carLicenseImage": { "url": "https://...", "expiresAt": "..." }
      }
    }
  }
}
```

**Errors**:

- `401` Not authenticated
- `403` User is not a DRIVER role
- `404` Driver not found

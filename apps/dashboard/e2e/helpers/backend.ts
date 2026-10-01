import type { Page, Route } from "@playwright/test";

/**
 * Stateful in-browser-network backend for the dashboard e2e suite.
 *
 * Every request the app makes goes to the same-origin prefix `/__api`
 * (see playwright.config.ts), so `page.route` can intercept it with zero
 * CORS ceremony. The backend keeps per-test mutable state: a session flag,
 * fixtures that mutations write back to, a request log, and scenario hooks
 * (one-shot access-token expiry) used by the auth tests.
 */

export const ADMIN_ID = "usr-admin-0001";
export const ADMIN_EMAIL = "admin@ainrider.com";
export const ADMIN_PASSWORD = "admin-pass-123";
export const ADMIN_FULL_NAME = "Amina Hassan";

const adminDto = {
  id: ADMIN_ID,
  email: ADMIN_EMAIL,
  firstName: "Amina",
  lastName: "Hassan",
  phoneNumber: "+201001234567",
  role: "ADMIN",
  status: "ACTIVE",
  createdAt: "2025-01-05T09:00:00.000Z",
  updatedAt: "2025-01-05T09:00:00.000Z",
};

/** Shape written by zustand/persist into localStorage under `auth-storage`. */
const persistedAuth = {
  state: {
    user: {
      id: ADMIN_ID,
      email: ADMIN_EMAIL,
      firstName: "Amina",
      lastName: "Hassan",
      fullName: ADMIN_FULL_NAME,
      phoneNumber: "+201001234567",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: "2025-01-05T09:00:00.000Z",
      updatedAt: "2025-01-05T09:00:00.000Z",
    },
    isAuthenticated: true,
  },
  version: 0,
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const users = [
  {
    id: "usr-rider-0001",
    email: "ahmed@example.com",
    phoneNumber: "+201001112223",
    firstName: "Ahmed",
    lastName: "Salah",
    role: "RIDER",
    status: "ACTIVE",
    profileImage: null,
    createdAt: "2025-03-11T08:30:00.000Z",
    updatedAt: "2025-03-11T08:30:00.000Z",
  },
  {
    id: "usr-driver-0002",
    email: "mona@example.com",
    phoneNumber: "+201223334445",
    firstName: "Mona",
    lastName: "Kamal",
    role: "DRIVER",
    status: "ACTIVE",
    profileImage: null,
    createdAt: "2025-02-02T12:00:00.000Z",
    updatedAt: "2025-02-02T12:00:00.000Z",
    roleData: {
      id: "drv-0002",
      userId: "usr-driver-0002",
      vehicleId: "veh-0007",
      licenseNumber: "LM-4471",
      rating: 4.8,
      totalTrips: 132,
      isOnline: true,
      createdAt: "2025-02-02T12:00:00.000Z",
      updatedAt: "2025-02-02T12:00:00.000Z",
    },
  },
  {
    id: "usr-sup-0003",
    email: "omar@example.com",
    phoneNumber: "+201234445556",
    firstName: "Omar",
    lastName: "Fathi",
    role: "SUPPORT",
    status: "INACTIVE",
    profileImage: null,
    createdAt: "2025-01-20T10:00:00.000Z",
    updatedAt: "2025-01-20T10:00:00.000Z",
  },
];

const userStats = {
  total: 3,
  byRole: { RIDER: 1, DRIVER: 1, SUPPORT: 1 },
  byStatus: { ACTIVE: 2, INACTIVE: 1 },
  onlineDrivers: 1,
};

const trips = [
  {
    id: "trip-1001",
    riderId: "usr-rider-0001",
    driverId: "usr-driver-0002",
    status: "COMPLETED",
    pickupLat: 30.0444,
    pickupLng: 31.2357,
    pickupAddress: "Tahrir Square, Cairo",
    dropoffLat: 30.1219,
    dropoffLng: 31.4056,
    dropoffAddress: "Cairo International Airport",
    estimatedFare: 80,
    actualFare: 85,
    paymentMethod: "CASH",
    paymentStatus: "COLLECTED",
    promoCode: null,
    promoDiscount: 0,
    distance: 21.4,
    duration: 2400,
    requestedAt: "2025-06-01T09:00:00.000Z",
    matchedAt: "2025-06-01T09:02:00.000Z",
    startedAt: "2025-06-01T09:05:00.000Z",
    completedAt: "2025-06-01T09:45:00.000Z",
    cancelledAt: null,
    cancellationReason: null,
    cancelledBy: null,
    driverRating: 5,
    riderRating: 4,
    updatedAt: "2025-06-01T09:45:00.000Z",
  },
  {
    id: "trip-1002",
    riderId: "usr-rider-0001",
    driverId: "usr-driver-0002",
    status: "IN_PROGRESS",
    pickupLat: 29.9773,
    pickupLng: 31.1325,
    pickupAddress: "Giza Pyramid Gate",
    dropoffLat: 29.9917,
    dropoffLng: 31.1887,
    dropoffAddress: "Grand Egyptian Museum",
    estimatedFare: 60,
    actualFare: null,
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
    promoCode: null,
    promoDiscount: 0,
    distance: null,
    duration: null,
    requestedAt: "2025-06-02T14:00:00.000Z",
    matchedAt: "2025-06-02T14:03:00.000Z",
    startedAt: "2025-06-02T14:05:00.000Z",
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledBy: null,
    driverRating: null,
    riderRating: null,
    updatedAt: "2025-06-02T14:05:00.000Z",
  },
  {
    id: "trip-1003",
    riderId: "usr-rider-0001",
    driverId: null,
    status: "REQUESTED",
    pickupLat: 30.0614,
    pickupLng: 31.2212,
    pickupAddress: "Nile City Tower",
    dropoffLat: 30.0881,
    dropoffLng: 31.3357,
    dropoffAddress: "City Stars Mall",
    estimatedFare: 45,
    actualFare: null,
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
    promoCode: null,
    promoDiscount: 0,
    distance: null,
    duration: null,
    requestedAt: "2025-06-03T18:00:00.000Z",
    matchedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledBy: null,
    driverRating: null,
    riderRating: null,
    updatedAt: "2025-06-03T18:00:00.000Z",
  },
];

const tripStats = {
  total: 3,
  completed: 1,
  cancelled: 0,
  inProgress: 1,
  revenue: 85,
  pendingPayments: 0,
  collectedPayments: 1,
};

const complaints = [
  {
    id: "cpl-2001",
    complainantId: "usr-rider-0001",
    complainantRole: "RIDER",
    againstUserId: "usr-driver-0002",
    tripId: "trip-1001",
    type: "LATE_DRIVER",
    status: "PENDING",
    priority: "HIGH",
    subject: "Driver arrived late",
    description: "The driver arrived 25 minutes after the trip was matched.",
    evidence: null,
    assignedTo: undefined,
    resolution: undefined,
    resolutionNotes: undefined,
    createdAt: "2025-06-04T10:00:00.000Z",
    updatedAt: "2025-06-04T10:00:00.000Z",
    resolvedAt: undefined,
    comments: [
      {
        id: "cmt-1",
        complaintId: "cpl-2001",
        userId: "usr-sup-0003",
        userRole: "SUPPORT",
        comment: "We are checking the trip timeline.",
        isInternal: true,
        createdAt: "2025-06-04T11:00:00.000Z",
      },
    ],
  },
  {
    id: "cpl-2002",
    complainantId: "usr-rider-0001",
    complainantRole: "RIDER",
    againstUserId: undefined,
    tripId: "trip-1002",
    type: "FARE_DISPUTE",
    status: "RESOLVED",
    priority: "MEDIUM",
    subject: "Wrong fare charged",
    description: "The final fare did not match the estimate shown in the app.",
    evidence: null,
    assignedTo: "usr-admin-0001",
    resolution: "Fare corrected and the difference was refunded to the wallet.",
    resolutionNotes: undefined,
    createdAt: "2025-05-20T09:00:00.000Z",
    updatedAt: "2025-05-21T09:00:00.000Z",
    resolvedAt: "2025-05-21T09:00:00.000Z",
    comments: [],
  },
];

const withdrawals = [
  {
    id: "wdl-3001",
    userId: "usr-driver-0002",
    amount: 250,
    status: "PENDING",
    bankDetails: {
      accountName: "Mona Kamal",
      accountNumber: "EG38-0019-0005",
      bankName: "NBE",
    },
    processedBy: undefined,
    processedAt: undefined,
    rejectionReason: undefined,
    createdAt: "2025-06-05T08:00:00.000Z",
    updatedAt: "2025-06-05T08:00:00.000Z",
  },
  {
    id: "wdl-3002",
    userId: "usr-driver-0002",
    amount: 100,
    status: "PENDING",
    bankDetails: {
      accountName: "Mona Kamal",
      accountNumber: "EG38-0019-0005",
      bankName: "NBE",
    },
    processedBy: undefined,
    processedAt: undefined,
    rejectionReason: undefined,
    createdAt: "2025-06-06T08:00:00.000Z",
    updatedAt: "2025-06-06T08:00:00.000Z",
  },
  {
    id: "wdl-3003",
    userId: "usr-driver-0002",
    amount: 400,
    status: "COMPLETED",
    bankDetails: {
      accountName: "Mona Kamal",
      accountNumber: "EG38-0019-0005",
      bankName: "NBE",
    },
    processedBy: "usr-admin-0001",
    processedAt: "2025-05-30T12:00:00.000Z",
    rejectionReason: undefined,
    createdAt: "2025-05-29T12:00:00.000Z",
    updatedAt: "2025-05-30T12:00:00.000Z",
  },
];

const promos = [
  {
    id: "promo-4001",
    code: "WELCOME20",
    type: "PERCENTAGE",
    value: 20,
    maxDiscount: 50,
    minTripAmount: 30,
    maxUsagePerUser: 1,
    totalUsageLimit: 1000,
    currentUsageCount: 42,
    status: "ACTIVE",
    validFrom: "2025-05-01T00:00:00.000Z",
    validUntil: "2025-12-31T00:00:00.000Z",
    description: "20% off the first ride",
    createdBy: "usr-admin-0001",
    createdAt: "2025-05-01T00:00:00.000Z",
    updatedAt: "2025-05-01T00:00:00.000Z",
  },
  {
    id: "promo-4002",
    code: "SUMMER10",
    type: "FIXED",
    value: 10,
    maxDiscount: undefined,
    minTripAmount: 25,
    maxUsagePerUser: 2,
    totalUsageLimit: 500,
    currentUsageCount: 500,
    status: "EXPIRED",
    validFrom: "2025-06-01T00:00:00.000Z",
    validUntil: "2025-06-30T00:00:00.000Z",
    description: "10 EGP off summer rides",
    createdBy: "usr-admin-0001",
    createdAt: "2025-06-01T00:00:00.000Z",
    updatedAt: "2025-06-30T00:00:00.000Z",
  },
];

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

async function json(
  route: Route,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
    headers,
  });
}

const SESSION_COOKIE = "e2e-session=; Path=/__api; HttpOnly; SameSite=Lax";
const SESSION_COOKIE_SET =
  "e2e-session=valid; Path=/__api; HttpOnly; SameSite=Lax";

export class MockBackend {
  /** Set-Cookie bookkeeping: true while the mocked server considers the session alive. */
  private sessionValid = false;
  private expireOncePattern: RegExp | null = null;
  readonly requests: RecordedRequest[] = [];
  refreshCalls = 0;

  static async install(page: Page): Promise<MockBackend> {
    const backend = new MockBackend();
    backend.registerRoutes(page);
    return backend;
  }

  /** Marks the server-side session as live and seeds the persisted auth store. */
  async authenticate(page: Page): Promise<void> {
    this.sessionValid = true;
    await page.addInitScript((auth) => {
      window.localStorage.setItem("auth-storage", JSON.stringify(auth));
    }, persistedAuth);
  }

  /** Kills the server-side session (cookies rejected from here on). */
  invalidate(): void {
    this.sessionValid = false;
  }

  /** Makes the next request matching `pattern` fail with a 401 access-token expiry. */
  expireOnce(pattern: RegExp): void {
    this.expireOncePattern = pattern;
  }

  /** Requests recorded so far, e.g. PATCH bodies for round-trip assertions. */
  recorded(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    pattern: RegExp,
  ): RecordedRequest[] {
    return this.requests.filter(
      (r) => r.method === method && pattern.test(r.path),
    );
  }

  // ─── route wiring ─────────────────────────────────────────────────────────

  private registerRoutes(page: Page): void {
    // Playwright consults routes from the most recently registered backwards,
    // so the catch-all must go in FIRST to act as the fallback of last resort.
    page.route("**/__api/**", (route) => {
      const request = route.request();
      console.warn(
        `[e2e-backend] unmocked request: ${request.method()} ${new URL(request.url()).pathname}`,
      );
      return json(route, 404, {
        message: `e2e mock missing: ${new URL(request.url()).pathname}`,
      });
    });

    // auth (globs match the full URL incl. query string, so every pattern
    // ends with ** to stay query-proof; more specific routes go AFTER the
    // broad ones because later registrations take precedence)
    page.route("**/auth/login**", (route) => this.handleLogin(route));
    page.route("**/auth/me**", (route) => this.handleMe(route));
    page.route("**/auth/refresh**", (route) => this.handleRefresh(route));
    page.route("**/auth/logout**", (route) => this.handleLogout(route));
    page.route("**/auth/ws-token**", (route) =>
      json(route, 200, { token: "e2e-ws-token" }),
    );

    // trips
    page.route("**/admin/trips**", (route) => this.handleTrips(route));
    page.route("**/admin/trips/stats**", (route) =>
      this.guarded(route, () => json(route, 200, tripStats)),
    );

    // users
    page.route("**/admin/users**", (route) => this.handleUsers(route));
    page.route("**/admin/users/stats**", (route) =>
      this.guarded(route, () => json(route, 200, userStats)),
    );
    page.route("**/admin/users/*/onboarding-status**", (route) =>
      this.guarded(route, () =>
        json(route, 200, {
          data: {
            status: "APPROVED",
            documents: [],
            uploadAttemptsRemaining: 3,
          },
        }),
      ),
    );

    // complaints
    page.route("**/admin/complaints**", (route) =>
      this.handleComplaints(route),
    );
    page.route("**/admin/complaints/*", (route) =>
      this.guarded(route, () => {
        const id = new URL(route.request().url()).pathname.split("/").pop();
        const complaint = complaints.find((c) => c.id === id);
        if (!complaint) return json(route, 404, { message: "Not found" });
        return json(route, 200, complaint);
      }),
    );
    page.route("**/admin/complaints/*/status**", (route) =>
      this.handleComplaintStatus(route),
    );

    // promos / wallets / notifications
    page.route("**/admin/promos**", (route) =>
      this.guarded(route, () => json(route, 200, promos)),
    );
    page.route("**/admin/withdrawals**", (route) =>
      this.handleWithdrawals(route),
    );
    page.route("**/admin/withdrawals/*/process**", (route) =>
      this.handleWithdrawalProcess(route),
    );
    page.route("**/admin/notifications**", (route) =>
      this.guarded(route, () => json(route, 200, [])),
    );
  }

  private record(route: Route): void {
    const request = route.request();
    let body: unknown;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    this.requests.push({
      method: request.method(),
      path: new URL(request.url()).pathname,
      body,
    });
  }

  /** Runs `handler` unless the session is dead or a one-shot expiry is armed for this path. */
  private async guarded(
    route: Route,
    handler: () => Promise<void>,
  ): Promise<void> {
    this.record(route);
    const path = new URL(route.request().url()).pathname;
    if (this.expireOncePattern?.test(path)) {
      this.expireOncePattern = null;
      return json(route, 401, { message: "Access token expired" });
    }
    if (!this.sessionValid) {
      return json(route, 401, { message: "Unauthorized" });
    }
    return handler();
  }

  // ─── auth handlers ────────────────────────────────────────────────────────

  private async handleLogin(route: Route): Promise<void> {
    this.record(route);
    let body: { email?: string; password?: string } = {};
    try {
      body = route.request().postDataJSON() as {
        email?: string;
        password?: string;
      };
    } catch {
      // fall through to rejection below
    }
    if (body.email === ADMIN_EMAIL && body.password === ADMIN_PASSWORD) {
      this.sessionValid = true;
      return json(
        route,
        200,
        { user: adminDto, success: true },
        { "Set-Cookie": SESSION_COOKIE_SET },
      );
    }
    return json(route, 401, { message: "Invalid credentials" });
  }

  private async handleMe(route: Route): Promise<void> {
    this.record(route);
    if (this.sessionValid) {
      return json(route, 200, adminDto);
    }
    return json(route, 401, { message: "Unauthorized" });
  }

  private async handleRefresh(route: Route): Promise<void> {
    this.record(route);
    this.refreshCalls += 1;
    if (this.sessionValid) {
      return json(
        route,
        200,
        { success: true },
        { "Set-Cookie": SESSION_COOKIE_SET },
      );
    }
    return json(
      route,
      401,
      { message: "Refresh token expired" },
      { "Set-Cookie": SESSION_COOKIE },
    );
  }

  private async handleLogout(route: Route): Promise<void> {
    this.record(route);
    this.sessionValid = false;
    return json(
      route,
      200,
      { success: true },
      { "Set-Cookie": SESSION_COOKIE },
    );
  }

  // ─── data handlers ────────────────────────────────────────────────────────

  private async handleTrips(route: Route): Promise<void> {
    return this.guarded(route, async () => {
      const params = new URL(route.request().url()).searchParams;
      const search = params.get("search")?.toLowerCase();
      const status = params.get("status");
      let list = trips;
      if (status) list = list.filter((t) => t.status === status);
      if (search) {
        list = list.filter((t) =>
          [t.id, t.riderId, t.driverId ?? "", t.pickupAddress, t.dropoffAddress]
            .join(" ")
            .toLowerCase()
            .includes(search),
        );
      }
      return json(route, 200, {
        trips: list,
        total: list.length,
        page: 1,
        limit: 20,
      });
    });
  }

  private async handleUsers(route: Route): Promise<void> {
    return this.guarded(route, async () => {
      const params = new URL(route.request().url()).searchParams;
      const search = params.get("search")?.toLowerCase();
      const role = params.get("role");
      const status = params.get("status");
      let list = users;
      if (role) list = list.filter((u) => u.role === role);
      if (status) list = list.filter((u) => u.status === status);
      if (search) {
        list = list.filter((u) =>
          [u.firstName, u.lastName, u.email, u.phoneNumber]
            .join(" ")
            .toLowerCase()
            .includes(search),
        );
      }
      return json(route, 200, {
        users: list,
        total: list.length,
        page: 1,
        limit: 20,
      });
    });
  }

  private async handleComplaints(route: Route): Promise<void> {
    return this.guarded(route, async () => {
      const params = new URL(route.request().url()).searchParams;
      const status = params.get("status");
      const list = status
        ? complaints.filter((c) => c.status === status)
        : complaints;
      return json(route, 200, {
        data: list,
        total: list.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });
  }

  private async handleComplaintStatus(route: Route): Promise<void> {
    return this.guarded(route, async () => {
      let body: { status?: string; assignedTo?: string; resolution?: string } =
        {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        // handled below via optional chaining
      }
      const id = new URL(route.request().url()).pathname.split("/").at(-2);
      const complaint = complaints.find((c) => c.id === id);
      if (!complaint || !body.status) {
        return json(route, 400, { message: "Bad request" });
      }
      complaint.status = body.status;
      complaint.assignedTo = body.assignedTo;
      if (body.status === "RESOLVED") {
        complaint.resolution = body.resolution;
        complaint.resolvedAt = new Date().toISOString();
      }
      complaint.updatedAt = new Date().toISOString();
      return json(route, 200, complaint);
    });
  }

  private async handleWithdrawals(route: Route): Promise<void> {
    return this.guarded(route, async () => {
      const params = new URL(route.request().url()).searchParams;
      const status = params.get("status");
      const list = status
        ? withdrawals.filter((w) => w.status === status)
        : withdrawals;
      return json(route, 200, list);
    });
  }

  private async handleWithdrawalProcess(route: Route): Promise<void> {
    return this.guarded(route, async () => {
      let body: { approve?: boolean; rejectionReason?: string } = {};
      try {
        body = route.request().postDataJSON() as typeof body;
      } catch {
        // handled below via optional chaining
      }
      const id = new URL(route.request().url()).pathname.split("/").at(-2);
      const withdrawal = withdrawals.find((w) => w.id === id);
      if (!withdrawal || typeof body.approve !== "boolean") {
        return json(route, 400, { message: "Bad request" });
      }
      withdrawal.status = body.approve ? "COMPLETED" : "REJECTED";
      withdrawal.processedBy = ADMIN_ID;
      withdrawal.processedAt = new Date().toISOString();
      withdrawal.rejectionReason = body.approve
        ? undefined
        : body.rejectionReason;
      withdrawal.updatedAt = new Date().toISOString();
      return json(route, 200, withdrawal);
    });
  }
}

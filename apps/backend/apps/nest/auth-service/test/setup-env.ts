/**
 * Hermetic test environment for auth-service.
 *
 * Runs before each test file is imported. Points the service at the
 * dedicated ainrider_auth_test database and the shared docker infra
 * (see @ain-rider/test-utils), and removes provider env that must not
 * leak into the console-provider tests.
 */
import "reflect-metadata";
import { loadTestEnv, testDatabaseUrl } from "@ain-rider/test-utils";

loadTestEnv();

process.env.DATABASE_URL = testDatabaseUrl("auth");
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.INTERNAL_SERVICE_SECRET ||= "test-internal-secret";
process.env.MINIO_DEFAULT_BUCKET = "ain-rider-test";
process.env.MINIO_PRESIGNED_TTL = "3600";
process.env.OTP_PROVIDER = "console";
process.env.NODE_ENV = "test";

delete process.env.TEST_OTP_CODE;
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;

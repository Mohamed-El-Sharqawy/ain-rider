export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateImageFile(file: {
  mimetype: string;
  size: number;
}): void {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(
      `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File too large. Max size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    );
  }
}

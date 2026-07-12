const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type CloudinaryUpload = {
  secure_url?: string;
  error?: { message?: string };
};

export class MediaService {
  private readonly cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  private readonly uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "";
  private readonly apiKey = process.env.CLOUDINARY_API_KEY || "";
  private readonly apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  private assertImage(file: File) {
    if (!IMAGE_TYPES.has(file.type) || file.size <= 0) {
      throw new Error("errors.invalid_upload");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("errors.file_too_large");
    }
  }

  public uploadMediaSingle = async (file: File): Promise<string> => {
    this.assertImage(file);

    if (!this.cloudName || !this.uploadPreset) {
      throw new Error("errors.upload_not_configured");
    }

    const body = new FormData();
    body.set("file", file);
    body.set("upload_preset", this.uploadPreset);
    body.set("folder", "veritas");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: "POST", body },
    );
    const result = (await response.json()) as CloudinaryUpload;

    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message || "errors.upload_failed");
    }

    return result.secure_url;
  };

  public uploadMediaMultiple = async (files: File[]): Promise<string[]> => {
    return Promise.all(files.map((file) => this.uploadMediaSingle(file)));
  };

  public deleteMedia = async (url?: string | null) => {
    try {
      const publicId = this.publicIdFromUrl(url);
      if (!publicId || !this.cloudName || !this.apiKey || !this.apiSecret)
        return;

      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = await this.sign(
        `public_id=${publicId}&timestamp=${timestamp}${this.apiSecret}`,
      );
      const body = new FormData();
      body.set("public_id", publicId);
      body.set("timestamp", timestamp);
      body.set("api_key", this.apiKey);
      body.set("signature", signature);

      await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`,
        { method: "POST", body },
      );
    } catch (error) {
      console.error("Media cleanup failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  private publicIdFromUrl(url?: string | null) {
    if (
      !url ||
      !url.includes("res.cloudinary.com") ||
      !url.includes("/upload/")
    ) {
      return null;
    }

    const path = url.split("/upload/")[1]?.split(/[?#]/)[0];
    const withoutVersion = path?.replace(/^v\d+\//, "");
    return withoutVersion?.replace(/\.[^/.]+$/, "") ?? null;
  }

  private async sign(value: string) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-1", bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
}

export const mediaService = new MediaService();

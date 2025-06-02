// Simple proxy server with caching and rate limiting
const fetch = require("node-fetch");
const NodeCache = require("node-cache");
const sharp = require("sharp");

// Cache configuration (TTL: 1 week in seconds)
const imageCache = new NodeCache({
  stdTTL: 604800,
  checkperiod: 60 * 60, // check for expired keys every hour
  useClones: false, // store buffers as-is
});

// Rate limiting configuration
const rateLimiter = {
  requests: {}, // IP -> timestamps map
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 15, // max 15 requests per minute per IP
  isRateLimited: function (ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Initialize or clean old requests
    if (!this.requests[ip]) {
      this.requests[ip] = [];
    }

    // Remove old timestamps
    this.requests[ip] = this.requests[ip].filter((time) => time > windowStart);

    // Check if rate limited
    if (this.requests[ip].length >= this.maxRequests) {
      return true;
    }

    // Add current request timestamp
    this.requests[ip].push(now);
    return false;
  },
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get the image URL and optimization parameters from query
  const { url: imageUrl, width, height, quality, format } = req.query;

  if (!imageUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  // Simple validation to only allow certain domains
  if (!imageUrl.includes("artsco202525.speedgabia.com")) {
    return res.status(403).json({ error: "Domain not allowed" });
  }

  // Apply rate limiting based on IP
  const clientIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  if (rateLimiter.isRateLimited(clientIp)) {
    return res
      .status(429)
      .json({ error: "Too many requests, please try again later" });
  }

  try {
    // Create cache key including optimization parameters
    const cacheKey = `${imageUrl}-w${width || "auto"}-h${height || "auto"}-q${
      quality || "auto"
    }-f${format || "auto"}`;

    const cachedImage = imageCache.get(cacheKey);

    if (cachedImage) {
      // Set appropriate headers
      res.setHeader("Content-Type", cachedImage.contentType);
      res.setHeader("Cache-Control", "public, max-age=604800");
      res.setHeader("X-Cache", "HIT");

      // Return cached image
      return res.status(200).send(cachedImage.data);
    }

    // Fetch the image
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
    }

    // Get the image buffer
    const imageBuffer = await response.buffer();

    // Initialize sharp with the image
    let sharpImage = sharp(imageBuffer);

    // Get image metadata
    const metadata = await sharpImage.metadata();

    // Resize if width or height is specified
    if (width || height) {
      sharpImage = sharpImage.resize({
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Set format and quality
    let outputFormat = format || metadata.format;
    const outputQuality = quality ? parseInt(quality) : undefined;

    // Smart format handling
    if (!format) {
      // Always keep original format, normalizing jpg to jpeg
      outputFormat = metadata.format === "jpg" ? "jpeg" : metadata.format;
    } else if (format === "jpg" || format === "jpeg") {
      // Ensure jpg/jpeg stays as jpeg
      outputFormat = "jpeg";
    } else if (format === "webp" && metadata.format !== "png") {
      // Only allow WebP conversion for non-PNG images
      outputFormat = "webp";
    } else {
      // Default to keeping original format
      outputFormat = metadata.format === "jpg" ? "jpeg" : metadata.format;
    }

    // Apply format-specific optimizations
    if (outputFormat === "jpeg") {
      sharpImage = sharpImage.jpeg({
        quality: outputQuality || 80,
        mozjpeg: true, // Use mozjpeg for better compression
        force: false, // Don't force JPEG on PNG images
      });
    } else if (outputFormat === "webp") {
      sharpImage = sharpImage.webp({
        quality: outputQuality || 80,
        effort: 4,
      });
    } else if (outputFormat === "png") {
      sharpImage = sharpImage.png({
        compressionLevel: 9,
        palette: true,
      });
    }

    // Process the image
    const processedImageBuffer = await sharpImage.toBuffer();

    // Set proper MIME type
    const mimeTypes = {
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    const contentType = mimeTypes[outputFormat] || `image/${outputFormat}`;

    // Add format information in headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Original-Format", metadata.format);
    res.setHeader("X-Output-Format", outputFormat);
    res.setHeader("Cache-Control", "public, max-age=604800");
    res.setHeader("X-Cache", "MISS");

    // Store in cache with format information
    imageCache.set(cacheKey, {
      data: processedImageBuffer,
      contentType: contentType,
      originalFormat: metadata.format,
      outputFormat: outputFormat,
    });

    // Return the processed image
    return res.status(200).send(processedImageBuffer);
  } catch (error) {
    console.error("Proxy error:", error);
    return res.status(500).json({ error: "Failed to process image" });
  }
};

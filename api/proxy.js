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
      // If no format specified, keep original format but normalize 'jpg' to 'jpeg'
      outputFormat = metadata.format === "jpg" ? "jpeg" : metadata.format;
    } else if (format === "webp") {
      // Allow WebP conversion for better compression
      outputFormat = "webp";
    } else if (format === "jpg" || format === "jpeg") {
      // Normalize jpg/jpeg
      outputFormat = "jpeg";
    } else if (format === "png" && metadata.hasAlpha) {
      // Only allow PNG if image has transparency
      outputFormat = "png";
    } else {
      // Default to keeping original format
      outputFormat = metadata.format === "jpg" ? "jpeg" : metadata.format;
    }

    // Apply format-specific optimizations
    if (outputFormat === "jpeg") {
      sharpImage = sharpImage.jpeg({
        quality: outputQuality || 80,
        mozjpeg: true, // Use mozjpeg for better compression
      });
    } else if (outputFormat === "webp") {
      sharpImage = sharpImage.webp({
        quality: outputQuality || 80,
        effort: 4, // Balance between compression speed and size
      });
    } else if (outputFormat === "png") {
      sharpImage = sharpImage.png({
        compressionLevel: 9, // Maximum compression
        palette: true, // Use palette for better compression when possible
      });
    }

    // Process the image
    const processedImageBuffer = await sharpImage.toBuffer();

    // Determine content type based on format
    const contentType = `image/${
      outputFormat === "jpg" ? "jpeg" : outputFormat
    }`;

    // Store in cache
    imageCache.set(cacheKey, {
      data: processedImageBuffer,
      contentType: contentType,
    });

    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=604800");
    res.setHeader("X-Cache", "MISS");

    // Return the processed image
    return res.status(200).send(processedImageBuffer);
  } catch (error) {
    console.error("Proxy error:", error);
    return res.status(500).json({ error: "Failed to process image" });
  }
};

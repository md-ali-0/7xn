const rateLimit = require("express-rate-limit")
const { body, validationResult } = require("express-validator")

// Enhanced rate limiting for different endpoints
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.log(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`)
      res.status(429).render("error", {
        title: "Too Many Requests",
        error: {
          status: 429,
          message: message,
        },
        isAuthenticated: false,
        isAdmin: false,
        currentUser: null,
      })
    },
  })
}

// Different rate limiters for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  "Too many authentication attempts. Please try again in 15 minutes.",
)

const adminLimiter = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  20, // 20 requests
  "Too many admin requests. Please slow down.",
)

const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  "Too many requests from this IP. Please try again later.",
)

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts from request body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        // Basic XSS prevention - remove script tags and javascript: protocols
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "")
      }
    }
  }
  next()
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString()
  const method = req.method
  const url = req.url
  const ip = req.ip || req.connection.remoteAddress
  const userAgent = req.get("User-Agent") || "Unknown"

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`)

  // Log authentication attempts
  if (req.path.includes("/auth/login") && req.method === "POST") {
    // Check if req.body exists before accessing email
    const email = req.body && req.body.email ? req.body.email : "Unknown"
    console.log(`[AUTH ATTEMPT] IP: ${ip} - Email: ${email}`)
  }

  next()
}

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional security headers beyond helmet
  res.setHeader("X-Powered-By", "Gmail-Checker-Auth")
  res.setHeader("X-Request-ID", require("crypto").randomUUID())

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff")

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block")

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  next()
}

// Session security middleware
const sessionSecurity = (req, res, next) => {
  // Regenerate session ID periodically for security
  if (req.session && req.session.user) {
    const now = Date.now()
    const sessionAge = now - (req.session.createdAt || now)

    // Regenerate session every 2 hours
    if (sessionAge > 2 * 60 * 60 * 1000) {
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err)
        } else {
          req.session.createdAt = now
          console.log(`Session regenerated for user: ${req.session.user.username}`)
        }
        next()
      })
    } else {
      next()
    }
  } else {
    next()
  }
}

// CSRF protection middleware (simple implementation)
const csrfProtection = (req, res, next) => {
  // Skip CSRF protection for API routes
  if (req.path.startsWith('/auth/api/')) {
    return next();
  }
  
  // Generate CSRF token for all requests (not just GET)
  if (!req.session.csrfToken) {
    req.session.csrfToken = require("crypto").randomBytes(32).toString("hex")
  }
  
  // Always make CSRF token available in res.locals for all requests
  res.locals.csrfToken = req.session.csrfToken
  
  if (req.method === "GET") {
    next()
  } else {
    // Validate CSRF token for POST requests
    const token = req.body._csrf || req.headers["x-csrf-token"]
    if (!token || token !== req.session.csrfToken) {
      console.log(`CSRF token mismatch for IP: ${req.ip}, Path: ${req.path}`)
      return res.status(403).render("error", {
        title: "Forbidden",
        error: {
          status: 403,
          message: "Invalid security token. Please refresh the page and try again.",
        },
        isAuthenticated: res.locals.isAuthenticated || false,
        isAdmin: res.locals.isAdmin || false,
        currentUser: res.locals.currentUser || null,
      })
    }
    next()
  }
}

// Validation schemas for common inputs
const userValidationRules = [
  body("username")
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username must be 3-20 characters and contain only letters, numbers, and underscores"),
  body("email").isEmail().normalizeEmail().withMessage("Please enter a valid email address"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
]

const packageValidationRules = [
  body("name").isLength({ min: 2, max: 50 }).withMessage("Package name must be 2-50 characters long"),
  body("emailCredits").isInt({ min: 0, max: 1000000 }).withMessage("Email credits must be between 0 and 1,000,000"),
  body("concurrencyLimit").isInt({ min: 1, max: 1000 }).withMessage("Concurrency limit must be between 1 and 1,000"),
]

// Error handling for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    req.validationErrors = errors.array()
  }
  next()
}

module.exports = {
  authLimiter,
  adminLimiter,
  generalLimiter,
  sanitizeInput,
  requestLogger,
  securityHeaders,
  sessionSecurity,
  csrfProtection,
  userValidationRules,
  packageValidationRules,
  handleValidationErrors,
}

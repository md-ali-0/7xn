const express = require("express")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const helmet = require("helmet")
const cors = require("cors")
const rateLimit = require("express-rate-limit")
const path = require("path")
require("dotenv").config()

// Import database connection
const connectDB = require("./config/db")

const Package = require("./models/Package")
const User = require("./models/User")
const seedDatabase = require("./scripts/seed-database")

// Import routes
const authRoutes = require("./routes/auth")
const dashboardRoutes = require("./routes/dashboard")
const adminRoutes = require("./routes/admin")

// Import middleware
const { isAuthenticated, loadUser } = require("./middleware/auth")
const {
  generalLimiter,
  authLimiter,
  adminLimiter,
  sanitizeInput,
  requestLogger,
  securityHeaders,
  sessionSecurity,
  csrfProtection,
} = require("./middleware/security")
const { performanceMonitor } = require("./middleware/monitoring")

const app = express()
const PORT = process.env.PORT || 3000

// Connect to MongoDB and seed database
connectDB().then(async () => {
  try {
    await Package.createDefaultPackages()
    await User.createDefaultAdmin()
    console.log("Database initialization completed")
  } catch (error) {
    console.error("Database initialization error:", error)
  }
})

// Trust proxy for accurate IP addresses
app.set("trust proxy", 1)

// Request logging and performance monitoring
app.use(requestLogger)
app.use(performanceMonitor)

// Security headers
app.use(securityHeaders)

// Enhanced security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
)

// CORS configuration
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? false : "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 200,
  }),
)

// General rate limiting
app.use(generalLimiter)

// Body parsing middleware with size limits
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 100,
  }),
)
app.use(
  express.json({
    limit: "10mb",
  }),
)

// Input sanitization
app.use(sanitizeInput)

// Static files with security headers
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    setHeaders: (res, path) => {
      if (path.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript")
      }
      if (path.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css")
      }
    },
  }),
)

// View engine setup
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

// Session configuration with enhanced security
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      touchAfter: 24 * 3600, // lazy session update
      ttl: 30 * 60, // 30 minutes TTL
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: "strict",
    },
    name: "sessionId", // Don't use default session name
    genid: () => {
      return require("crypto").randomBytes(32).toString("hex")
    },
  }),
)

// Session security middleware
app.use(sessionSecurity)

// CSRF protection
app.use(csrfProtection)

// Load user middleware
app.use(loadUser)

// Routes with specific rate limiting
app.get("/", (req, res) => {
  res.render("index", { title: "Gmail Checker Authentication" })
})

// Health check endpoint
app.get("/health", (req, res) => {
  const { healthCheck } = require("./middleware/monitoring")
  res.json({
    status: "healthy",
    ...healthCheck.getSystemStats(),
  })
})

app.use("/auth", authLimiter, authRoutes)
app.use("/dashboard", isAuthenticated, dashboardRoutes)
app.use("/admin", isAuthenticated, adminLimiter, adminRoutes)

// 404 handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url} - IP: ${req.ip}`)
  res.status(404).render("error", {
    title: "Page Not Found",
    error: { status: 404, message: "Page not found" },
    isAuthenticated: res.locals.isAuthenticated || false,
    isAdmin: res.locals.isAdmin || false,
    currentUser: res.locals.currentUser || null,
  })
})

// Enhanced error handler
app.use((err, req, res, next) => {
  // Log error details
  console.error(`[ERROR] ${err.stack}`)

  // Log security-related errors
  if (err.status === 403 || err.status === 401) {
    const { securityLogger } = require("./middleware/monitoring")
    securityLogger.logSecurityEvent(req, "ACCESS_DENIED", err.message)
  }

  // Don't leak error details in production
  const errorDetails =
    process.env.NODE_ENV === "production" ? { status: err.status || 500, message: "Something went wrong!" } : err

  res.status(err.status || 500).render("error", {
    title: "Error",
    error: errorDetails,
    isAuthenticated: res.locals.isAuthenticated || false,
    isAdmin: res.locals.isAdmin || false,
    currentUser: res.locals.currentUser || null,
  })
})

// Graceful shutdown with cleanup
const gracefulShutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`)

  // Close server
  const server = app.listen(PORT)
  server.close(() => {
    console.log("HTTP server closed.")

    // Close database connection
    const mongoose = require("mongoose")
    mongoose.connection.close(() => {
      console.log("Database connection closed.")
      process.exit(0)
    })
  })

  // Force close after 10 seconds
  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down")
    process.exit(1)
  }, 10000)
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  process.exit(1)
})

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`Security features: Enhanced`)
})

module.exports = app

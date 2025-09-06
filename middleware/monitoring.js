const fs = require("fs")
const path = require("path")

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env.NOW_REGION || process.env.VERCEL_ENV

// Only create logs directory if we're not in a serverless environment
let logsDir = null
if (!isServerless) {
  logsDir = path.join(__dirname, "../logs")
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true })
    } catch (error) {
      console.warn("Could not create logs directory:", error.message)
    }
  }
}

// Security event logging
const securityLogger = {
  logAuthAttempt: (req, success, reason = null) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: "AUTH_ATTEMPT",
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      email: req.body.email,
      success: success,
      reason: reason,
    }

    // Only write to file if we're not in a serverless environment
    if (logsDir) {
      try {
        const logFile = path.join(logsDir, "security.log")
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")
      } catch (error) {
        console.warn("Could not write to security log:", error.message)
      }
    }

    if (!success) {
      console.warn(`[SECURITY] Failed login attempt: ${req.body.email} from ${req.ip} - ${reason}`)
    }
  },

  logAdminAction: (req, action, target = null) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: "ADMIN_ACTION",
      ip: req.ip,
      admin: req.session.user?.username,
      action: action,
      target: target,
      userAgent: req.get("User-Agent"),
    }

    // Only write to file if we're not in a serverless environment
    if (logsDir) {
      try {
        const logFile = path.join(logsDir, "admin.log")
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")
      } catch (error) {
        console.warn("Could not write to admin log:", error.message)
      }
    }

    console.log(`[ADMIN] ${req.session.user?.username} performed ${action} on ${target || "system"}`)
  },

  logSecurityEvent: (req, event, details = null) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: "SECURITY_EVENT",
      ip: req.ip,
      event: event,
      details: details,
      userAgent: req.get("User-Agent"),
    }

    // Only write to file if we're not in a serverless environment
    if (logsDir) {
      try {
        const logFile = path.join(logsDir, "security.log")
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")
      } catch (error) {
        console.warn("Could not write to security log:", error.message)
      }
    }

    console.warn(`[SECURITY] ${event}: ${details || "No details"} from ${req.ip}`)
  },
}

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now()

  res.on("finish", () => {
    const duration = Date.now() - startTime
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      ip: req.ip,
    }

    // Log slow requests (> 1 second) only if we're not in a serverless environment
    if (duration > 1000 && logsDir) {
      console.warn(`[PERFORMANCE] Slow request: ${req.method} ${req.url} - ${duration}ms`)
      try {
        const logFile = path.join(logsDir, "performance.log")
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")
      } catch (error) {
        console.warn("Could not write to performance log:", error.message)
      }
    }
  })

  next()
}

// System health monitoring
const healthCheck = {
  getSystemStats: () => {
    const memUsage = process.memoryUsage()
    const uptime = process.uptime()

    return {
      timestamp: new Date().toISOString(),
      uptime: uptime,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + " MB",
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
      },
      nodeVersion: process.version,
      platform: process.platform,
    }
  },

  logSystemStats: () => {
    // Only log system stats if we're not in a serverless environment
    if (logsDir) {
      try {
        const stats = healthCheck.getSystemStats()
        const logFile = path.join(logsDir, "system.log")
        fs.appendFileSync(logFile, JSON.stringify(stats) + "\n")
      } catch (error) {
        console.warn("Could not write to system log:", error.message)
      }
    }
  },
}

// Log system stats every hour (only if we're not in a serverless environment)
if (!isServerless) {
  setInterval(
    () => {
      healthCheck.logSystemStats()
    },
    60 * 60 * 1000,
  )
}

module.exports = {
  securityLogger,
  performanceMonitor,
  healthCheck,
}
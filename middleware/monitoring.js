const fs = require("fs")
const path = require("path")

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs")
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
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

    const logFile = path.join(logsDir, "security.log")
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")

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

    const logFile = path.join(logsDir, "admin.log")
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")

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

    const logFile = path.join(logsDir, "security.log")
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")

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

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`[PERFORMANCE] Slow request: ${req.method} ${req.url} - ${duration}ms`)
      const logFile = path.join(logsDir, "performance.log")
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")
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
    const stats = healthCheck.getSystemStats()
    const logFile = path.join(logsDir, "system.log")
    fs.appendFileSync(logFile, JSON.stringify(stats) + "\n")
  },
}

// Log system stats every hour
setInterval(
  () => {
    healthCheck.logSystemStats()
  },
  60 * 60 * 1000,
)

module.exports = {
  securityLogger,
  performanceMonitor,
  healthCheck,
}

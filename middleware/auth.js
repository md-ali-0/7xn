const User = require("../models/User")
const Package = require("../models/Package")

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next()
  } else {
    // Check if req.session exists before setting returnTo
    if (req.session) {
      req.session.returnTo = req.originalUrl
    }
    return res.redirect("/auth/login")
  }
}

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.user) {
      return res.redirect("/auth/login")
    }

    const user = await User.findById(req.session.user._id)

    if (!user || user.role !== "admin") {
      return res.status(403).render("error", {
        title: "Access Denied",
        error: {
          status: 403,
          message: "You do not have permission to access this resource.",
        },
        isAuthenticated: false,
        isAdmin: false,
        currentUser: null,
      })
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Admin check error:", error)
    return res.status(500).render("error", {
      title: "Server Error",
      error: {
        status: 500,
        message: "An error occurred while checking permissions.",
      },
    })
  }
}

// Middleware to check if user's package is valid
const checkPackageValidity = async (req, res, next) => {
  try {
    if (!req.session || !req.session.user) {
      return res.redirect("/auth/login")
    }

    const user = await User.findById(req.session.user._id).populate("package")

    if (!user) {
      req.session.destroy()
      return res.redirect("/auth/login")
    }

    // Check if user is active
    if (!user.isActive) {
      req.session.destroy()
      return res.render("error", {
        title: "Account Deactivated",
        error: {
          status: 403,
          message: "Your account has been deactivated. Please contact support.",
        },
        isAuthenticated: false,
        isAdmin: false,
        currentUser: null,
      })
    }

    // Skip package validation for admin users
    if (!user.isAdmin() && !user.isPackageValid()) {
      return res.render("error", {
        title: "Package Expired",
        error: {
          status: 403,
          message: "Your package has expired. Please contact support to renew your subscription.",
        },
        isAuthenticated: false,
        isAdmin: false,
        currentUser: null,
      })
    }

    // Update session with latest user data
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    }

    // Only add package info for non-admin users
    if (!user.isAdmin() && user.package) {
      req.session.user.package = user.package
      req.session.user.packageEndDate = user.packageEndDate
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Package validity check error:", error)
    return res.status(500).render("error", {
      title: "Server Error",
      error: {
        status: 500,
        message: "An error occurred while checking your account status.",
      },
      isAuthenticated: false,
      isAdmin: false,
      currentUser: null,
    })
  }
}

// Middleware to load user data for templates
const loadUser = async (req, res, next) => {
  try {
    if (req.session && req.session.user) {
      const user = await User.findById(req.session.user._id).populate("package")

      if (user && user.isActive) {
        // For admin users, skip package validity check
        if (user.isAdmin() || user.isPackageValid()) {
          res.locals.currentUser = user
          res.locals.isAuthenticated = true
          res.locals.isAdmin = user.role === "admin"
        } else {
          // Clear invalid session for non-admin users with expired packages
          req.session.destroy()
          res.locals.currentUser = null
          res.locals.isAuthenticated = false
          res.locals.isAdmin = false
        }
      } else {
        // Clear invalid session
        req.session.destroy()
        res.locals.currentUser = null
        res.locals.isAuthenticated = false
        res.locals.isAdmin = false
      }
    } else {
      res.locals.currentUser = null
      res.locals.isAuthenticated = false
      res.locals.isAdmin = false
    }

    next()
  } catch (error) {
    console.error("Load user error:", error)
    res.locals.currentUser = null
    res.locals.isAuthenticated = false
    res.locals.isAdmin = false
    next()
  }
}

// Middleware to redirect authenticated users away from auth pages
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect("/dashboard")
  }
  next()
}

module.exports = {
  isAuthenticated,
  isAdmin,
  checkPackageValidity,
  loadUser,
  redirectIfAuthenticated,
}

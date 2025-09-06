const express = require("express")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const { redirectIfAuthenticated } = require("../middleware/auth")
const { authLimiter } = require("../middleware/security")

const router = express.Router()

// Login page
router.get("/login", redirectIfAuthenticated, (req, res) => {
  // Check if we're redirecting from another page
  const returnTo = req.session.returnTo || "/dashboard"
  // Clear the returnTo to prevent redirect loops
  delete req.session.returnTo

  res.render("login", {
    title: "Login",
    error: null,
    email: "",
    returnTo: returnTo,
    csrfToken: res.locals.csrfToken,
  })
})

// Handle login
router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().normalizeEmail().withMessage("Please enter a valid email address"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)

      if (!errors.isEmpty()) {
        return res.render("login", {
          title: "Login",
          error: errors.array()[0].msg,
          email: req.body.email || "",
          csrfToken: res.locals.csrfToken,
        })
      }

      const { email, password } = req.body

      // Find user by email
      const user = await User.findOne({ email }).populate("package")

      if (!user) {
        return res.render("login", {
          title: "Login",
          error: "Invalid email or password",
          email: email,
          csrfToken: res.locals.csrfToken,
        })
      }

      // Check if user is active
      if (!user.isActive) {
        return res.render("login", {
          title: "Login",
          error: "Your account has been deactivated. Please contact support.",
          email: email,
          csrfToken: res.locals.csrfToken,
        })
      }

      // Check if non-admin user has valid package
      if (!user.isAdmin() && !user.isPackageValid()) {
        return res.render("login", {
          title: "Login",
          error: "Your package has expired. Please contact support to renew your subscription.",
          email: email,
          csrfToken: res.locals.csrfToken,
        })
      }

      // Compare password
      const isMatch = await user.comparePassword(password)

      if (!isMatch) {
        return res.render("login", {
          title: "Login",
          error: "Invalid email or password",
          email: email,
          csrfToken: res.locals.csrfToken,
        })
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err)
          return res.render("login", {
            title: "Login",
            error: "An error occurred during login. Please try again.",
            email: email,
            csrfToken: res.locals.csrfToken,
          })
        }

        // Store user data in session
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

        // Preserve CSRF token during session regeneration
        req.session.csrfToken = res.locals.csrfToken

        // Set session creation time
        req.session.createdAt = Date.now()

        // Redirect to intended page or dashboard
        const returnTo = req.session.returnTo || "/dashboard"
        delete req.session.returnTo

        res.redirect(returnTo)
      })
    } catch (error) {
      console.error("Login error:", error)
      res.render("login", {
        title: "Login",
        error: "An error occurred during login. Please try again.",
        email: req.body.email || "",
        csrfToken: res.locals.csrfToken,
      })
    }
  },
)

// Handle logout
router.post("/logout", (req, res) => {
  // Get the user ID from session if available
  const userId = req.session.user ? req.session.user._id.toString() : null;
  
  // Remove device association if exists
  if (userId && req.session.activeDevices && req.session.activeDevices[userId]) {
    delete req.session.activeDevices[userId];
  }
  
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err)
      return res.redirect("/dashboard")
    }
    res.clearCookie("sessionId")
    res.redirect("/auth/login")
  })
})

// API endpoint for desktop application login
router.post(
  "/api/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
    body("device_id").notEmpty().withMessage("Device ID is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array()
        })
      }

      const { username, password, device_id } = req.body

      // Find user by username
      const user = await User.findOne({ username }).populate("package")

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password"
        })
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact support."
        })
      }

      // Check if non-admin user has valid package
      if (!user.isAdmin() && !user.isPackageValid()) {
        return res.status(403).json({
          success: false,
          message: "Your package has expired. Please contact support to renew your subscription."
        })
      }

      // Compare password
      const isMatch = await user.comparePassword(password)

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password"
        })
      }

      // Check if user has a registered device
      if (user.registeredDeviceId) {
        // If user has a registered device, check if it matches the provided device_id
        if (user.registeredDeviceId !== device_id) {
          return res.status(403).json({
            success: false,
            message: "This account is registered to a different device. Please use your registered device or contact support to reset your device."
          })
        }
      } else {
        // If user doesn't have a registered device, save the current device_id
        user.registeredDeviceId = device_id
        await user.save()
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Generate a simple token for desktop app (in a real app, you might want to use JWT)
      const token = require("crypto").randomBytes(32).toString("hex")

      // Store token in session-like structure (simplified for desktop app)
      // In a real implementation, you might want to use a proper token system
      req.session.desktopTokens = req.session.desktopTokens || {}
      req.session.desktopTokens[token] = {
        userId: user._id,
        deviceId: device_id,
        createdAt: new Date()
      }

      // Return user data and token
      res.json({
        success: true,
        message: "Login successful",
        token: token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          package: user.package ? {
            id: user.package._id,
            name: user.package.name,
            emailCredits: user.package.emailCredits,
            concurrencyLimit: user.package.concurrencyLimit
          } : null,
          packageEndDate: user.packageEndDate
        }
      })
    } catch (error) {
      console.error("Desktop login error:", error)
      res.status(500).json({
        success: false,
        message: "An error occurred during login. Please try again."
      })
    }
  }
)

// API endpoint to verify desktop app token
router.post("/api/verify-token", async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required"
      })
    }

    // Check if token exists in session
    if (!req.session.desktopTokens || !req.session.desktopTokens[token]) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      })
    }

    // Get user from token
    const tokenData = req.session.desktopTokens[token]
    const user = await User.findById(tokenData.userId).populate("package")

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support."
      })
    }

    // Check if non-admin user has valid package
    if (!user.isAdmin() && !user.isPackageValid()) {
      return res.status(403).json({
        success: false,
        message: "Your package has expired. Please contact support to renew your subscription."
      })
    }

    // Check if the user is still logged in on the same device
    if (!req.session.activeDevices) {
      req.session.activeDevices = {}
    }

    const userId = user._id.toString()
    if (req.session.activeDevices[userId] !== tokenData.deviceId) {
      // User has logged in on a different device, invalidate this token
      delete req.session.desktopTokens[token]
      return res.status(401).json({
        success: false,
        message: "Session invalidated. User logged in on a different device."
      })
    }

    // Return user data
    res.json({
      success: true,
      message: "Token is valid",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        package: user.package ? {
          id: user.package._id,
          name: user.package.name,
          emailCredits: user.package.emailCredits,
          concurrencyLimit: user.package.concurrencyLimit
        } : null,
        packageEndDate: user.packageEndDate
      }
    })
  } catch (error) {
    console.error("Token verification error:", error)
    res.status(500).json({
      success: false,
      message: "An error occurred during token verification. Please try again."
    })
  }
})

// API endpoint for desktop application logout
router.post("/api/logout", async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required"
      })
    }

    // Check if token exists in session
    if (req.session.desktopTokens && req.session.desktopTokens[token]) {
      // Get user from token
      const tokenData = req.session.desktopTokens[token]
      const userId = tokenData.userId.toString()
      
      // Remove device association
      if (req.session.activeDevices && req.session.activeDevices[userId]) {
        delete req.session.activeDevices[userId];
      }
      
      // Remove token
      delete req.session.desktopTokens[token]
      
      return res.json({
        success: true,
        message: "Logout successful"
      })
    }

    res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    })
  } catch (error) {
    console.error("Desktop logout error:", error)
    res.status(500).json({
      success: false,
      message: "An error occurred during logout. Please try again."
    })
  }
})

module.exports = router
const express = require("express")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const Package = require("../models/Package")
const { redirectIfAuthenticated } = require("../middleware/auth")
const { securityLogger } = require("../middleware/monitoring")

const router = express.Router()

// Login page
router.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("login", {
    title: "Login",
    error: null,
    email: "",
    csrfToken: res.locals.csrfToken || req.session.csrfToken
  })
})

// Handle login
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Please enter a valid email address"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)

      if (!errors.isEmpty()) {
        securityLogger.logAuthAttempt(req, false, "Validation failed")
        return res.render("login", {
          title: "Login",
          error: errors.array()[0].msg,
          email: req.body.email || "",
          csrfToken: res.locals.csrfToken || req.session.csrfToken
        })
      }

      const { email, password } = req.body

      // Find user by email and populate package
      const user = await User.findOne({ email }).populate("package")

      if (!user) {
        securityLogger.logAuthAttempt(req, false, "User not found")
        return res.render("login", {
          title: "Login",
          error: "Invalid email or password",
          email: email,
          csrfToken: res.locals.csrfToken || req.session.csrfToken
        })
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password)

      if (!isPasswordValid) {
        securityLogger.logAuthAttempt(req, false, "Invalid password")
        return res.render("login", {
          title: "Login",
          error: "Invalid email or password",
          email: email,
          csrfToken: res.locals.csrfToken || req.session.csrfToken
        })
      }

      // Check if user is active
      if (!user.isActive) {
        securityLogger.logAuthAttempt(req, false, "Account deactivated")
        return res.render("login", {
          title: "Login",
          error: "Your account has been deactivated. Please contact support.",
          email: email,
          csrfToken: res.locals.csrfToken || req.session.csrfToken
        })
      }

      // Check if package is valid (skip for admin users)
      if (!user.isAdmin() && !user.isPackageValid()) {
        securityLogger.logAuthAttempt(req, false, "Package expired")
        return res.render("login", {
          title: "Login",
          error: "Your package has expired. Please contact support to renew your subscription.",
          email: email,
          csrfToken: res.locals.csrfToken || req.session.csrfToken
        })
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Create session (handle admin users who may not have a package)
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
        req.session.user.packageStartDate = user.packageStartDate
        req.session.user.packageEndDate = user.packageEndDate
      }

      // Regenerate session ID for security
      const oldCsrfToken = req.session.csrfToken; // Save the CSRF token
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err)
          securityLogger.logAuthAttempt(req, false, "Session regeneration failed")
          return res.render("login", {
            title: "Login",
            error: "Login failed. Please try again.",
            email: email,
            csrfToken: res.locals.csrfToken || req.session.csrfToken
          })
        }

        // Restore the CSRF token after session regeneration
        if (oldCsrfToken) {
          req.session.csrfToken = oldCsrfToken;
        }

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
          req.session.user.packageStartDate = user.packageStartDate
          req.session.user.packageEndDate = user.packageEndDate
        }

        req.session.createdAt = Date.now()

        // Log successful authentication
        securityLogger.logAuthAttempt(req, true)

        // Redirect to intended page or dashboard
        const redirectTo = req.session.returnTo || "/dashboard"
        delete req.session.returnTo
        res.redirect(redirectTo)
      })
    } catch (error) {
      console.error("Login error:", error)
      securityLogger.logAuthAttempt(req, false, "Server error")
      res.render("login", {
        title: "Login",
        error: "An error occurred during login. Please try again.",
        email: req.body.email || "",
        csrfToken: res.locals.csrfToken || req.session.csrfToken
      })
    }
  },
)

// Handle logout
router.post("/logout", (req, res) => {
  const username = req.session.user?.username

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err)
      return res.redirect("/dashboard")
    }

    console.log(`User logged out: ${username}`)
    res.clearCookie("sessionId")
    res.redirect("/")
  })
})

// Logout GET route for convenience
router.get("/logout", (req, res) => {
  const username = req.session.user?.username

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err)
      return res.redirect("/dashboard")
    }

    console.log(`User logged out: ${username}`)
    res.clearCookie("sessionId")
    res.redirect("/")
  })
})

module.exports = router

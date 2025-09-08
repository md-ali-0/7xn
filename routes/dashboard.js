const express = require("express")
const User = require("../models/User")
const Package = require("../models/Package")
const { checkPackageValidity, isAdmin } = require("../middleware/auth")

const router = express.Router()

// Dashboard page
router.get("/", checkPackageValidity, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate("package")

    if (!user) {
      req.session.destroy()
      return res.redirect("/auth/login")
    }

    // Calculate days until expiry (only for non-admin users with packages)
    let daysUntilExpiry = null
    if (!user.isAdmin() && user.package) {
      daysUntilExpiry = user.getDaysUntilExpiry()
    }

    // Get package statistics for admin
    let stats = null
    if (user.role === "admin") {
      const totalUsers = await User.countDocuments({ isActive: true })
      const expiredUsers = await User.countDocuments({
        packageEndDate: { $lt: new Date() },
      })
      const expiringUsers = await User.countDocuments({
        packageEndDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      })
      const totalPackages = await Package.countDocuments({ isActive: true })

      stats = {
        totalUsers,
        expiredUsers,
        expiringUsers,
        totalPackages,
      }
    }

    res.render("dashboard", {
      title: "Dashboard",
      user: user,
      daysUntilExpiry: daysUntilExpiry,
      stats: stats,
      layout: "layouts/dashboard"
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    res.status(500).render("error", {
      title: "Dashboard Error",
      error: {
        status: 500,
        message: "An error occurred while loading the dashboard.",
      },
      isAuthenticated: res.locals.isAuthenticated || false,
      isAdmin: res.locals.isAdmin || false,
      currentUser: res.locals.currentUser || null,
      layout: "layouts/main"
    })
  }
})

module.exports = router
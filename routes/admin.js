const express = require("express")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const PackageModel = require("../models/Package")
const { isAdmin } = require("../middleware/auth")

const router = express.Router()

// Apply admin middleware to all routes
router.use(isAdmin)

// Admin users list with search and filtering
router.get("/users", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const search = req.query.search || ""
    const roleFilter = req.query.role || ""
    const statusFilter = req.query.status || ""
    const packageFilter = req.query.package || ""

    // Build query object
    const query = {}

    // Search by username or email
    if (search) {
      query.$or = [{ username: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }]
    }

    // Filter by role
    if (roleFilter) {
      query.role = roleFilter
    }

    // Filter by status
    if (statusFilter === "active") {
      query.isActive = true
    } else if (statusFilter === "inactive") {
      query.isActive = false
    } else if (statusFilter === "expired") {
      query.packageEndDate = { $lt: new Date() }
    } else if (statusFilter === "expiring") {
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      query.packageEndDate = { $gte: new Date(), $lte: nextWeek }
    }

    // Filter by package
    if (packageFilter) {
      query.package = packageFilter
    }

    const users = await User.find(query).populate("package").sort({ createdAt: -1 }).skip(skip).limit(limit)

    const totalUsers = await User.countDocuments(query)
    const totalPages = Math.ceil(totalUsers / limit)

    // Get packages for filter dropdown
    const packages = await PackageModel.find({ isActive: true }).sort({ emailCredits: 1 })

    // Get statistics
    const stats = {
      total: await User.countDocuments(),
      active: await User.countDocuments({ isActive: true }),
      inactive: await User.countDocuments({ isActive: false }),
      expired: await User.countDocuments({ packageEndDate: { $lt: new Date() } }),
      expiring: await User.countDocuments({
        packageEndDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    }

    res.render("admin/users", {
      title: "User Management",
      users: users,
      packages: packages,
      stats: stats,
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      search: search,
      roleFilter: roleFilter,
      statusFilter: statusFilter,
      packageFilter: packageFilter,
      success: req.query.success || null,
      error: req.query.error || null,
      csrfToken: res.locals.csrfToken
    })
  } catch (error) {
    console.error("Admin users error:", error)
    res.status(500).render("error", {
      title: "Error",
      error: {
        status: 500,
        message: "An error occurred while loading users.",
      },
      isAuthenticated: false,
      isAdmin: false,
      currentUser: null,
    })
  }
})

router.post("/users/bulk-action", async (req, res) => {
  try {
    const { action, userIds } = req.body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.redirect("/admin/users?error=No users selected")
    }

    switch (action) {
      case "activate":
        await User.updateMany({ _id: { $in: userIds } }, { isActive: true })
        res.redirect("/admin/users?success=Selected users activated successfully")
        break

      case "deactivate":
        await User.updateMany({ _id: { $in: userIds } }, { isActive: false })
        res.redirect("/admin/users?success=Selected users deactivated successfully")
        break

      case "delete":
        // Check if any selected users are admins
        const adminUsers = await User.find({
          _id: { $in: userIds },
          role: "admin",
        })

        if (adminUsers.length > 0) {
          const totalAdmins = await User.countDocuments({ role: "admin" })
          if (totalAdmins <= adminUsers.length) {
            return res.redirect("/admin/users?error=Cannot delete all admin users")
          }
        }

        await User.deleteMany({ _id: { $in: userIds } })
        res.redirect("/admin/users?success=Selected users deleted successfully")
        break

      default:
        res.redirect("/admin/users?error=Invalid bulk action")
    }
  } catch (error) {
    console.error("Bulk action error:", error)
    res.redirect("/admin/users?error=An error occurred during bulk operation")
  }
})

router.get("/users/view/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("package")

    if (!user) {
      return res.status(404).render("error", {
        title: "User Not Found",
        error: {
          status: 404,
          message: "User not found",
        },
        isAuthenticated: false,
        isAdmin: false,
        currentUser: null,
      })
    }

    // Calculate additional user statistics
    const userStats = {
      daysUntilExpiry: user.getDaysUntilExpiry(),
      accountAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)),
      daysSinceLastLogin: user.lastLogin ? Math.floor((new Date() - user.lastLogin) / (1000 * 60 * 60 * 24)) : null,
    }

    res.render("admin/view-user", {
      title: `User Details - ${user.username}`,
      user: user,
      userStats: userStats,
    })
  } catch (error) {
    console.error("View user error:", error)
    res.status(500).render("error", {
      title: "Error",
      error: {
        status: 500,
        message: "An error occurred while loading user details.",
      },
      isAuthenticated: false,
      isAdmin: false,
      currentUser: null,
    })
  }
})

// Create user form
router.get("/users/create", async (req, res) => {
  try {
    const packages = await PackageModel.find({ isActive: true }).sort({ emailCredits: 1 })

    res.render("admin/create-user", {
      title: "Create User",
      packages: packages,
      error: null,
      formData: {},
      csrfToken: res.locals.csrfToken
    })
  } catch (error) {
    console.error("Create user form error:", error)
    res.status(500).render("error", {
      title: "Error",
      error: {
        status: 500,
        message: "An error occurred while loading the form.",
      },
      isAuthenticated: res.locals.isAuthenticated || false,
      isAdmin: res.locals.isAdmin || false,
      currentUser: res.locals.currentUser || null,
    })
  }
})

// Handle user creation
router.post(
  "/users/create",
  [
    body("username")
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Username must be 3-20 characters and contain only letters, numbers, and underscores"),
    body("email").isEmail().normalizeEmail().withMessage("Please enter a valid email address"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("package").isMongoId().withMessage("Please select a valid package"),
    body("packageEndDate").isISO8601().withMessage("Please enter a valid end date"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      const packages = await PackageModel.find({ isActive: true }).sort({ emailCredits: 1 })

      if (!errors.isEmpty()) {
        return res.render("admin/create-user", {
          title: "Create User",
          packages: packages,
          error: errors.array()[0].msg,
          formData: req.body,
          csrfToken: res.locals.csrfToken
        })
      }

      const { username, email, password, package: packageId, packageEndDate } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      })

      if (existingUser) {
        return res.render("admin/create-user", {
          title: "Create User",
          packages: packages,
          error: "User with this email or username already exists",
          formData: req.body,
          csrfToken: res.locals.csrfToken
        })
      }

      // Verify package exists
      const selectedPackage = await PackageModel.findById(packageId)
      if (!selectedPackage) {
        return res.render("admin/create-user", {
          title: "Create User",
          packages: packages,
          error: "Selected package not found",
          formData: req.body,
          csrfToken: res.locals.csrfToken
        })
      }

      // Create new user (always as user role)
      const newUser = new User({
        username,
        email,
        password,
        role: "user", // Always create as user
        package: packageId,
        packageStartDate: new Date(),
        packageEndDate: new Date(packageEndDate),
        isActive: true,
        emailVerified: true,
      })

      await newUser.save()

      res.redirect("/admin/users?success=User created successfully")
    } catch (error) {
      console.error("Create user error:", error)
      const packages = await PackageModel.find({ isActive: true }).sort({ emailCredits: 1 })

      res.render("admin/create-user", {
        title: "Create User",
        packages: packages,
        error: "An error occurred while creating the user. Please try again.",
        formData: req.body,
        csrfToken: res.locals.csrfToken
      })
    }
  },
)

// Edit user form
router.get("/users/edit/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("package")
    const packages = await PackageModel.find({ isActive: true }).sort({ emailCredits: 1 })

    if (!user) {
      return res.status(404).render("error", {
        title: "User Not Found",
        error: {
          status: 404,
          message: "User not found",
        },
        isAuthenticated: res.locals.isAuthenticated || false,
        isAdmin: res.locals.isAdmin || false,
        currentUser: res.locals.currentUser || null,
      })
    }

    res.render("admin/edit-user", {
      title: "Edit User",
      user: user,
      packages: packages,
      error: null,
      csrfToken: res.locals.csrfToken
    })
  } catch (error) {
    console.error("Edit user form error:", error)
    res.status(500).render("error", {
      title: "Error",
      error: {
        status: 500,
        message: "An error occurred while loading the user.",
      },
      isAuthenticated: res.locals.isAuthenticated || false,
      isAdmin: res.locals.isAdmin || false,
      currentUser: res.locals.currentUser || null,
    })
  }
})

// Handle user update
router.post(
  "/users/edit/:id",
  [
    body("username")
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Username must be 3-20 characters and contain only letters, numbers, and underscores"),
    body("email").isEmail().normalizeEmail().withMessage("Please enter a valid email address"),
    body("role").isIn(["user", "admin"]).withMessage("Invalid role selected"),
    body("package").isMongoId().withMessage("Please select a valid package"),
    body("packageEndDate").isISO8601().withMessage("Please enter a valid end date"),
    body("isActive").isBoolean().withMessage("Invalid active status"),
  ],
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
      const packages = await PackageModel.find({ isActive: true }).sort({ emailCredits: 1 })

      if (!user) {
        return res.status(404).render("error", {
          title: "User Not Found",
          error: {
            status: 404,
            message: "User not found",
          },
          isAuthenticated: res.locals.isAuthenticated || false,
          isAdmin: res.locals.isAdmin || false,
          currentUser: res.locals.currentUser || null,
        })
      }

      const errors = validationResult(req)

      if (!errors.isEmpty()) {
        return res.render("admin/edit-user", {
          title: "Edit User",
          user: user,
          packages: packages,
          error: errors.array()[0].msg,
          csrfToken: res.locals.csrfToken
        })
      }

      const { username, email, password, role, package: packageId, packageEndDate, isActive } = req.body

      // Check if username/email is taken by another user
      const existingUser = await User.findOne({
        _id: { $ne: user._id },
        $or: [{ email }, { username }],
      })

      if (existingUser) {
        return res.render("admin/edit-user", {
          title: "Edit User",
          user: user,
          packages: packages,
          error: "Username or email is already taken by another user",
          csrfToken: res.locals.csrfToken
        })
      }

      // Update user fields
      user.username = username
      user.email = email
      user.role = role
      user.package = packageId
      user.packageEndDate = new Date(packageEndDate)
      user.isActive = isActive === "true"

      // Update password if provided
      if (password && password.trim() !== "") {
        user.password = password
      }

      await user.save()

      res.redirect("/admin/users?success=User updated successfully")
    } catch (error) {
      console.error("Update user error:", error)
      const user = await User.findById(req.params.id)
      const packages = await PackageModel.find({ isActive: true }).sort({ emailCredits: 1 })

      res.render("admin/edit-user", {
        title: "Edit User",
        user: user,
        packages: packages,
        error: "An error occurred while updating the user. Please try again.",
        csrfToken: res.locals.csrfToken
      })
    }
  },
)

// Delete user
router.post("/users/delete/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.redirect("/admin/users?error=User not found")
    }

    // Prevent deleting the last admin
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" })
      if (adminCount <= 1) {
        return res.redirect("/admin/users?error=Cannot delete the last admin user")
      }
    }

    await User.findByIdAndDelete(req.params.id)
    res.redirect("/admin/users?success=User deleted successfully")
  } catch (error) {
    console.error("Delete user error:", error)
    res.redirect("/admin/users?error=An error occurred while deleting the user")
  }
})

// Reset user device registration
router.post("/users/reset-device/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.redirect("/admin/users?error=User not found")
    }

    // Reset the registered device ID
    user.registeredDeviceId = null
    await user.save()

    res.redirect(`/admin/users?success=Device registration reset for user ${user.username}`)
  } catch (error) {
    console.error("Reset device error:", error)
    res.redirect("/admin/users?error=An error occurred while resetting the device registration")
  }
})

// Package management routes
router.get("/packages", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const packages = await PackageModel.find().sort({ emailCredits: 1 }).skip(skip).limit(limit)
    const totalPackages = await PackageModel.countDocuments()
    const totalPages = Math.ceil(totalPackages / limit)

    // Get package statistics
    const stats = {
      total: await PackageModel.countDocuments(),
      active: await PackageModel.countDocuments({ isActive: true }),
      inactive: await PackageModel.countDocuments({ isActive: false }),
    }

    // Get user counts per package
    const packageStats = await Promise.all(
      packages.map(async (pkg) => {
        const userCount = await User.countDocuments({ package: pkg._id })
        return {
          ...pkg.toObject(),
          userCount,
        }
      }),
    )

    res.render("admin/packages", {
      title: "Package Management",
      packages: packageStats,
      stats: stats,
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      totalPackages: totalPackages,
      success: req.query.success || null,
      error: req.query.error || null,
    })
  } catch (error) {
    console.error("Admin packages error:", error)
    res.status(500).render("error", {
      title: "Error",
      error: {
        status: 500,
        message: "An error occurred while loading packages.",
      },
    })
  }
})

// Create package form
router.get("/packages/create", (req, res) => {
  res.render("admin/create-package", {
    title: "Create Package",
    error: null,
    formData: {},
    csrfToken: res.locals.csrfToken
  })
})

// Handle package creation
router.post(
  "/packages/create",
  [
    body("name").isLength({ min: 2, max: 50 }).withMessage("Package name must be 2-50 characters long"),
    body("emailCredits").isInt({ min: 0, max: 1000000 }).withMessage("Email credits must be between 0 and 1,000,000"),
    body("concurrencyLimit").isInt({ min: 1, max: 1000 }).withMessage("Concurrency limit must be between 1 and 1,000"),
    body("features").optional().isString().withMessage("Features must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)

      if (!errors.isEmpty()) {
        return res.render("admin/create-package", {
          title: "Create Package",
          error: errors.array()[0].msg,
          formData: req.body,
          csrfToken: res.locals.csrfToken
        })
      }

      const { name, emailCredits, concurrencyLimit, features } = req.body

      // Check if package name already exists
      const existingPackage = await PackageModel.findOne({ name })
      if (existingPackage) {
        return res.render("admin/create-package", {
          title: "Create Package",
          error: "Package with this name already exists",
          formData: req.body,
          csrfToken: res.locals.csrfToken
        })
      }

      // Parse features from textarea
      const featureList = features
        ? features
            .split("\n")
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        : []

      const newPackage = new PackageModel({
        name,
        emailCredits: Number.parseInt(emailCredits),
        concurrencyLimit: Number.parseInt(concurrencyLimit),
        features: featureList,
        isActive: true,
      })

      await newPackage.save()
      res.redirect("/admin/packages?success=Package created successfully")
    } catch (error) {
      console.error("Create package error:", error)
      res.render("admin/create-package", {
        title: "Create Package",
        error: "An error occurred while creating the package. Please try again.",
        formData: req.body,
        csrfToken: res.locals.csrfToken
      })
    }
  },
)

// Edit package form
router.get("/packages/edit/:id", async (req, res) => {
  try {
    const pkg = await PackageModel.findById(req.params.id)

    if (!pkg) {
      return res.status(404).render("error", {
        title: "Package Not Found",
        error: {
          status: 404,
          message: "Package not found",
        },
        isAuthenticated: res.locals.isAuthenticated || false,
        isAdmin: res.locals.isAdmin || false,
        currentUser: res.locals.currentUser || null,
      })
    }

    res.render("admin/edit-package", {
      title: "Edit Package",
      package: pkg,
      error: null,
      csrfToken: res.locals.csrfToken
    })
  } catch (error) {
    console.error("Edit package form error:", error)
    res.status(500).render("error", {
      title: "Error",
      error: {
        status: 500,
        message: "An error occurred while loading the package.",
      },
      isAuthenticated: res.locals.isAuthenticated || false,
      isAdmin: res.locals.isAdmin || false,
      currentUser: res.locals.currentUser || null,
    })
  }
})

// Handle package update
router.post(
  "/packages/edit/:id",
  [
    body("name").isLength({ min: 2, max: 50 }).withMessage("Package name must be 2-50 characters long"),
    body("emailCredits").isInt({ min: 0, max: 1000000 }).withMessage("Email credits must be between 0 and 1,000,000"),
    body("concurrencyLimit").isInt({ min: 1, max: 1000 }).withMessage("Concurrency limit must be between 1 and 1,000"),
    body("features").optional().isString().withMessage("Features must be a string"),
    body("isActive").isBoolean().withMessage("Invalid active status"),
  ],
  async (req, res) => {
    try {
      const pkg = await PackageModel.findById(req.params.id)

      if (!pkg) {
        return res.status(404).render("error", {
          title: "Package Not Found",
          error: {
            status: 404,
            message: "Package not found",
          },
          isAuthenticated: res.locals.isAuthenticated || false,
          isAdmin: res.locals.isAdmin || false,
          currentUser: res.locals.currentUser || null,
        })
      }

      const errors = validationResult(req)

      if (!errors.isEmpty()) {
        return res.render("admin/edit-package", {
          title: "Edit Package",
          package: pkg,
          error: errors.array()[0].msg,
          csrfToken: res.locals.csrfToken
        })
      }

      const { name, emailCredits, concurrencyLimit, features, isActive } = req.body

      // Check if package name is taken by another package
      const existingPackage = await PackageModel.findOne({
        _id: { $ne: pkg._id },
        name: name,
      })

      if (existingPackage) {
        return res.render("admin/edit-package", {
          title: "Edit Package",
          package: pkg,
          error: "Package name is already taken by another package",
          csrfToken: res.locals.csrfToken
        })
      }

      // Parse features from textarea
      const featureList = features
        ? features
            .split("\n")
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        : []

      // Update package fields
      pkg.name = name
      pkg.emailCredits = Number.parseInt(emailCredits)
      pkg.concurrencyLimit = Number.parseInt(concurrencyLimit)
      pkg.features = featureList
      pkg.isActive = isActive === "true"

      await pkg.save()
      res.redirect("/admin/packages?success=Package updated successfully")
    } catch (error) {
      console.error("Update package error:", error)
      const pkg = await PackageModel.findById(req.params.id)

      res.render("admin/edit-package", {
        title: "Edit Package",
        package: pkg,
        error: "An error occurred while updating the package. Please try again.",
        csrfToken: res.locals.csrfToken
      })
    }
  },
)

// View package details
router.get("/packages/view/:id", async (req, res) => {
  try {
    const pkg = await PackageModel.findById(req.params.id)

    if (!pkg) {
      return res.status(404).render("error", {
        title: "Package Not Found",
        error: {
          status: 404,
          message: "Package not found",
        },
      })
    }

    // Get users with this package
    const users = await User.find({ package: pkg._id })
      .select("username email isActive packageEndDate")
      .sort({ createdAt: -1 })

    // Calculate package statistics
    const packageStats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      expiredUsers: users.filter((u) => u.packageEndDate < new Date()).length,
      packageAge: Math.floor((new Date() - pkg.createdAt) / (1000 * 60 * 60 * 24)),
    }

    res.render("admin/view-package", {
      title: `Package Details - ${pkg.name}`,
      package: pkg,
      users: users,
      packageStats: packageStats,
    })
  } catch (error) {
    console.error("View package error:", error)
    res.status(500).render("error", {
      title: "Error",
      error: {
        status: 500,
        message: "An error occurred while loading package details.",
      },
    })
  }
})

// Delete package
router.post("/packages/delete/:id", async (req, res) => {
  try {
    const pkg = await PackageModel.findById(req.params.id)

    if (!pkg) {
      return res.redirect("/admin/packages?error=Package not found")
    }

    // Check if any users are using this package
    const usersWithPackage = await User.countDocuments({ package: pkg._id })

    if (usersWithPackage > 0) {
      return res.redirect("/admin/packages?error=Cannot delete package that is assigned to users")
    }

    await PackageModel.findByIdAndDelete(req.params.id)
    res.redirect("/admin/packages?success=Package deleted successfully")
  } catch (error) {
    console.error("Delete package error:", error)
    res.redirect("/admin/packages?error=An error occurred while deleting the package")
  }
})

module.exports = router

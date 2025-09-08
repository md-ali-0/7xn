const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [20, "Username cannot exceed 20 characters"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      // Make package optional for admin users
      required: function() {
        return this.role !== "admin";
      },
    },
    packageStartDate: {
      type: Date,
      default: Date.now,
    },
    packageEndDate: {
      type: Date,
      // Make packageEndDate optional for admin users
      required: function() {
        return this.role !== "admin";
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    // Device ID for tracking user devices
    registeredDeviceId: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for better query performance
userSchema.index({ role: 1 })
userSchema.index({ isActive: 1 })
userSchema.index({ packageEndDate: 1 })
userSchema.index({ createdAt: -1 }) // For sorting by creation date
userSchema.index({ username: 1, email: 1 }) // For search operations
// Compound indexes for common query patterns
userSchema.index({ isActive: 1, role: 1 })
userSchema.index({ packageEndDate: 1, isActive: 1 })
userSchema.index({ "package": 1, "isActive": 1 })

// Pre-save hook to hash password
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next()

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password)
  } catch (error) {
    throw new Error("Password comparison failed")
  }
}

// Instance method to check if user's package is valid
userSchema.methods.isPackageValid = function () {
  const now = new Date()
  return this.isActive && this.packageEndDate > now
}

// Instance method to check if user is admin
userSchema.methods.isAdmin = function () {
  return this.role === "admin"
}

// Instance method to get days until package expires
userSchema.methods.getDaysUntilExpiry = function () {
  const now = new Date()
  const diffTime = this.packageEndDate - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Static method to find users with expiring packages
userSchema.statics.findExpiringPackages = function (days = 7) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  return this.find({
    isActive: true,
    packageEndDate: { $lte: futureDate, $gte: new Date() },
  }).populate("package")
}

// Static method to find expired users
userSchema.statics.findExpiredUsers = function () {
  return this.find({
    packageEndDate: { $lt: new Date() },
  }).populate("package")
}

// Static method to create admin user if none exists
userSchema.statics.createDefaultAdmin = async function () {
  try {
    const adminExists = await this.findOne({ role: "admin" })

    if (!adminExists) {
      const adminUser = new this({
        username: "admin",
        email: "admin@example.com",
        password: "admin123", // This will be hashed by the pre-save hook
        role: "admin",
        isActive: true,
        emailVerified: true,
      })

      await adminUser.save()
      console.log("Default admin user created: admin@example.com / admin123")
    }
  } catch (error) {
    console.error("Error creating default admin:", error)
  }
}

// Optimized method for admin user listing with pagination and filtering
userSchema.statics.findUsersWithFilters = async function(filters = {}, options = {}) {
  const {
    page = 1,
    limit = 10,
    search = "",
    roleFilter = "",
    statusFilter = "",
    packageFilter = ""
  } = options;

  const skip = (page - 1) * limit;

  // Build query object
  const query = {};

  // Apply filters
  Object.assign(query, filters);

  // Search by username or email
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }

  // Filter by role
  if (roleFilter) {
    query.role = roleFilter;
  }

  // Filter by status
  if (statusFilter === "active") {
    query.isActive = true;
  } else if (statusFilter === "inactive") {
    query.isActive = false;
  } else if (statusFilter === "expired") {
    query.packageEndDate = { $lt: new Date() };
  } else if (statusFilter === "expiring") {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    query.packageEndDate = { $gte: new Date(), $lte: nextWeek };
  }

  // Filter by package
  if (packageFilter) {
    query.package = packageFilter;
  }

  // Execute query with pagination
  const [users, total] = await Promise.all([
    this.find(query)
      .populate("package")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query)
  ]);

  return {
    users,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page
  };
};

// Optimized method for getting user statistics
userSchema.statics.getUserStats = async function() {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [total, active, inactive, expired, expiring] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.countDocuments({ isActive: false }),
    this.countDocuments({ packageEndDate: { $lt: now } }),
    this.countDocuments({
      packageEndDate: {
        $gte: now,
        $lte: nextWeek
      }
    })
  ]);

  return { total, active, inactive, expired, expiring };
};

// Virtual for user's full package info
userSchema.virtual("packageInfo", {
  ref: "Package",
  localField: "package",
  foreignField: "_id",
  justOne: true,
})

// Ensure virtual fields are serialized
userSchema.set("toJSON", { virtuals: true })
userSchema.set("toObject", { virtuals: true })

module.exports = mongoose.model("User", userSchema)
const mongoose = require("mongoose")

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Package name is required"],
      unique: true,
      trim: true,
      minlength: [2, "Package name must be at least 2 characters"],
      maxlength: [50, "Package name cannot exceed 50 characters"],
    },
    emailCredits: {
      type: Number,
      required: [true, "Email credits are required"],
      min: [0, "Email credits cannot be negative"],
      max: [1000000, "Email credits cannot exceed 1,000,000"],
    },
    concurrencyLimit: {
      type: Number,
      required: [true, "Concurrency limit is required"],
      min: [1, "Concurrency limit must be at least 1"],
      max: [1000, "Concurrency limit cannot exceed 1,000"],
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
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
packageSchema.index({ isActive: 1 })
packageSchema.index({ emailCredits: 1 }) // For sorting by credits
packageSchema.index({ name: 1 }) // For searching by name
// Compound indexes for common query patterns
packageSchema.index({ isActive: 1, emailCredits: 1 })

// Static method to get active packages
packageSchema.statics.getActivePackages = function () {
  return this.find({ isActive: true }).sort({ emailCredits: 1 })
}

// Static method to create default packages
packageSchema.statics.createDefaultPackages = async function () {
  const existingPackages = await this.countDocuments()

  if (existingPackages === 0) {
    const defaultPackages = [
      {
        name: "Free",
        emailCredits: 100,
        concurrencyLimit: 5,
        features: ["Basic email validation", "Standard support"],
        isActive: true,
      },
      {
        name: "Premium",
        emailCredits: 1000,
        concurrencyLimit: 20,
        features: ["Advanced email validation", "Priority support", "Bulk validation"],
        isActive: true,
      },
      {
        name: "Enterprise",
        emailCredits: 10000,
        concurrencyLimit: 50,
        features: ["Enterprise email validation", "24/7 support", "Custom integrations", "Advanced analytics"],
        isActive: true,
      },
    ]

    try {
      await this.insertMany(defaultPackages)
      console.log("Default packages created successfully")
    } catch (error) {
      console.error("Error creating default packages:", error)
    }
  }
}

// Instance method to check if package is valid
packageSchema.methods.isValidPackage = function () {
  return this.isActive
}

// Optimized method for getting package statistics
packageSchema.statics.getPackageStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || { total: 0, active: 0, inactive: 0 };
};

module.exports = mongoose.model("Package", packageSchema)
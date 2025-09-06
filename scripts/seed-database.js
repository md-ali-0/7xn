const mongoose = require("mongoose")
require("dotenv").config()

const Package = require("../models/Package")
const User = require("../models/User")

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)

    console.log("Connected to MongoDB")

    // Create default packages
    await Package.createDefaultPackages()

    // Create default admin user
    await User.createDefaultAdmin()

    console.log("Database seeding completed successfully")
  } catch (error) {
    console.error("Database seeding failed:", error)
  } finally {
    await mongoose.connection.close()
    console.log("Database connection closed")
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
}

module.exports = seedDatabase
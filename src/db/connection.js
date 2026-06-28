const bcrypt = require("bcryptjs");
const { supabase } = require("./supabase");
const User = require("../model/User");

let isConnected = false;

/**
 * Verify connectivity to Supabase and run lightweight initialization.
 * The schema itself is created by running supabase/schema.sql once
 * (see SUPABASE_SETUP.md).
 */
const connectDatabase = async () => {
  if (isConnected) return;

  try {
    console.log("Connecting to Supabase...");

    // Connectivity / schema check: a trivial count on the users table.
    const { error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("Failed to query Supabase:", error.message);
      if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
        console.error(
          "The 'users' table does not exist. Run supabase/schema.sql in the " +
            "Supabase SQL Editor (see SUPABASE_SETUP.md)."
        );
      } else {
        console.error(
          "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file."
        );
      }
      isConnected = false;
      // Continue with limited functionality (matches previous behaviour).
      return;
    }

    isConnected = true;
    console.log("Supabase connected successfully");

    await createDefaultAdmin();

    console.log("Database initialization completed");
  } catch (error) {
    console.error("Failed to connect to Supabase:", error.message);
    isConnected = false;
  }
};

/**
 * Create the default admin user if it doesn't already exist.
 */
const createDefaultAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "simonfinch@gmail.com";
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminRole = process.env.ADMIN_ROLE || "admin";

    const existingAdmin = await User.findOne({
      $or: [{ email: adminEmail }, { username: adminUsername }],
    });

    if (existingAdmin) {
      console.log("Admin user already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await User.create({
      email: adminEmail,
      password: hashedPassword,
      username: adminUsername,
      role: adminRole,
      lastLoginAt: null,
    });

    console.log("Default admin user created");
  } catch (error) {
    // A duplicate (code 11000) just means another process created it first.
    if (error.code === 11000) {
      console.log("Admin user already exists");
    } else {
      console.error("Error creating admin user:", error.message);
    }
  }
};

/**
 * No persistent connection to close with the Supabase HTTP client.
 */
const disconnectDatabase = async () => {
  isConnected = false;
};

/**
 * Basic database stats (row counts) for the main tables.
 */
const getDatabaseStats = async () => {
  try {
    const tables = ["users", "profiles", "courses", "materials"];
    const counts = {};
    for (const table of tables) {
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });
      counts[table] = count || 0;
    }
    return { database: "supabase", counts };
  } catch (error) {
    console.error("Error getting database stats:", error);
    return null;
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStats,
  isConnected: () => isConnected,
};

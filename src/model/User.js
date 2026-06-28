const { createModel } = require("../db/adapter");

// users table
const User = createModel("users", {
  columns: [
    "email",
    "password",
    "username",
    "role",
    "lastLoginAt",
    "isBlocked",
  ],
});

module.exports = User;

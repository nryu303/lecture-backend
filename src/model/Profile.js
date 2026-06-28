const { createModel } = require("../db/adapter");

// profiles table.
// student_id is a sparse-unique field: empty strings are stored as NULL so
// that many profiles without a student_id don't collide on the unique index.
const Profile = createModel("profiles", {
  columns: [
    "userId",
    "avatar",
    "phone",
    "gender",
    "birthday",
    "faceDescriptor",
    "favorites",
    "group_id",
    "student_id",
    "companyName",
    "postalCode",
    "prefecture",
    "city",
    "addressOther",
  ],
  sparseNull: ["student_id"],
});

module.exports = Profile;

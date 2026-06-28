const { createModel } = require("../db/adapter");

// certificates table
const Certificate = createModel("certificates", {
  columns: [
    "userId",
    "certificateNumber",
    "name",
    "gender",
    "startDate",
    "endDate",
    "issueDate",
    "issuedBy",
  ],
});

module.exports = Certificate;

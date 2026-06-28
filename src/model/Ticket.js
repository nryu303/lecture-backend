const { createModel } = require("../db/adapter");

// tickets table
const Ticket = createModel("tickets", {
  columns: [
    "ticket_id",
    "course_id",
    "purchased_by",
    "assigned_to",
    "assigned_date",
    "status",
    "order_id",
  ],
});

module.exports = Ticket;

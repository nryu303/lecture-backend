const { createModel } = require("../db/adapter");

// orders table
const Order = createModel("orders", {
  columns: [
    "order_id",
    "group_admin_id",
    "purchase_date",
    "course_id",
    "quantity",
    "payment_id",
    "status",
  ],
});

module.exports = Order;

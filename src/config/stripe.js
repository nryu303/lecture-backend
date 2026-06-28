const Stripe = require("stripe");

// Initialize Stripe with secret key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error(
    "WARNING: STRIPE_SECRET_KEY is not set in environment variables"
  );
  console.error("Stripe payments will not work until this is configured");
  console.error("Current environment:", process.env.NODE_ENV);
} else {
  console.log("✅ Stripe configured successfully");
  console.log("Environment:", process.env.NODE_ENV);
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

module.exports = stripe;

// Lazy load models to prevent automatic collection creation at startup
// Only User model is loaded immediately since it's needed for authentication
const User = require("./User");

// Other models are loaded on-demand
const getProfile = () => require("./Profile");
const getCourse = () => require("./Course");
const getMaterial = () => require("./Material");
const getExamAttempt = () => require("./ExamAttempt");
const getNotification = () => require("./Notification");
const getCertificate = () => require("./Certificate");
const getFaceData = () => require("./FaceData");
const getOrder = () => require("./Order");
const getTicket = () => require("./Ticket");
const getEnrollment = () => require("./Enrollment");
// GroupTicket model has been removed

module.exports = {
  User,
  get Profile() {
    return getProfile();
  },
  get Course() {
    return getCourse();
  },
  get Material() {
    return getMaterial();
  },
  get ExamAttempt() {
    return getExamAttempt();
  },
  get Notification() {
    return getNotification();
  },
  get Certificate() {
    return getCertificate();
  },
  get FaceData() {
    return getFaceData();
  },
  get Order() {
    return getOrder();
  },
  get Ticket() {
    return getTicket();
  },
  get Enrollment() {
    return getEnrollment();
  },
  // GroupTicket has been removed
};

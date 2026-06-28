const { createModel } = require("../db/adapter");

// materials table
const Material = createModel("materials", {
  columns: [
    "type",
    "title",
    "description",
    "courseId",
    "courseName",
    "videoUrl",
    "videoFileName",
    "videoSize",
    "pdfUrl",
    "pdfFileName",
    "pdfSize",
    "tags",
    "uploadedBy",
    "uploadedAt",
    "lastModified",
    "viewCount",
    "downloadCount",
  ],
});

module.exports = Material;

const mongoose = require("mongoose");

const iterNoticeSchema = new mongoose.Schema(
  {
    noticeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    publishDate: {
      type: Date,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["exam", "academic", "cyclone_alert", "holiday", "administrative", "general"],
      default: "general",
      index: true,
    },
    categoryLabel: {
      type: String,
      default: "Notice",
    },
    summary: {
      type: String,
      default: "",
    },
    boxSharedName: {
      type: String,
      default: "",
    },
    boxFileVersionId: {
      type: String,
      default: "",
    },
    boxFileName: {
      type: String,
      default: "",
    },
    boxPreviewUrl: {
      type: String,
      default: "",
    },
    boxTemplateUrl: {
      type: String,
      default: "",
    },
    boxReadToken: {
      type: String,
      default: "",
    },
    boxFileId: {
      type: String,
      default: "",
    },
    pageCount: {
      type: Number,
      default: 1,
    },
    fullUrl: {
      type: String,
      default: "",
    },
    assetUrl: {
      type: String,
      default: "",
    },
    isNewNotice: {
      type: Boolean,
      default: true,
    },
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

iterNoticeSchema.index({ publishDate: -1 });

const IterNotice = mongoose.model("IterNotice", iterNoticeSchema);

module.exports = IterNotice;

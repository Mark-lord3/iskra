import { Schema, model, Types } from "mongoose";

/**
 * A safety report. Advisory only: nothing is removed automatically. A human
 * reviews and records what they decided.
 */
const reportSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    reporterId: { type: Types.ObjectId, ref: "User", required: true },
    subjectType: { type: String, enum: ["user", "group", "message"], required: true },
    subjectUserId: { type: Types.ObjectId, ref: "User", default: null },
    subjectGroupId: { type: Types.ObjectId, ref: "Group", default: null },
    subjectMessageId: { type: Types.ObjectId, ref: "Message", default: null },
    category: {
      type: String,
      enum: ["harassment", "impersonation", "explicit", "underage", "spam", "other"],
      default: "other"
    },
    note: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["open", "reviewing", "actioned", "dismissed"], default: "open", index: true },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" }
  },
  { timestamps: true }
);

// One open report per reporter per subject, so a repeat tap is not a new case.
reportSchema.index(
  { eventId: 1, reporterId: 1, subjectType: 1, subjectUserId: 1, subjectGroupId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } }
);

export const Report = model("Report", reportSchema);

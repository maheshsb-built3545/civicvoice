/**
 * Ward.js
 * -----------------------------------------------------------------------
 * Ward model with 2dsphere indexed GeoJSON Polygon boundary.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const wardSchema = new Schema(
  {
    name: { type: String, required: true },
    marathiName: { type: String },
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
        required: true,
      },
      coordinates: {
        type: [[[Number]]], // [[[lng, lat], [lng, lat], ...]]
        required: true,
      },
    },
    defaultDepartmentMap: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
  }
);

wardSchema.index({ boundary: '2dsphere' });

module.exports = mongoose.model('Ward', wardSchema);

const mongoose = require("mongoose");

// Partner Model
const partnerSchema = new mongoose.Schema(
  {
    bookings: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    }],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    subService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubService",
    },

    kyc: {
      panCard: String,
      aadhaar: String,
      chequeImage: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      remarks: String // For admin to provide feedback if rejected
    },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
      chequeImage: String,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: function () {
        return this.profileCompleted;
      },
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: function () {
        return this.profileCompleted;
      },
    },
    service: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: function () {
          return this.profileCompleted;
        },
      },
    ],
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    whatsappNumber: String,
    qualification: String,
    experience: String,
    modeOfService: {
      type: String,
      enum: ["online", "offline", "both"],
      required: function () {
        return this.profileCompleted;
      },
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    profileStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    profile: {
      name: {
        type: String,
        required: function () {
          return this.profileCompleted;
        },
        trim: true,
      },
      email: {
        type: String,
        required: function () {
          return this.profileCompleted;
        },
        trim: true,
        lowercase: true,
      },
      address: {
        type: String,
        required: function () {
          return this.profileCompleted;
        }
      },
      landmark: {
        type: String,
        required: function () {
          return this.profileCompleted;
        }
      },
      pincode: {
        type: String,
        required: function () {
          return this.profileCompleted;
        }
      },
    },
    profilePicture: String,

    // Add OTP fields
    tempOTP: {
      type: String,
      select: false, // Ensure it is only retrieved when explicitly selected
    },
    otpExpiry: {
      type: Date,
      select: false, // Ensures it is fetched only when explicitly requested
    },

    // Add Reviews Field
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
        rating: { type: Number, required: true },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const Partner  = mongoose.model("Partner", partnerSchema);
module.exports = Partner;

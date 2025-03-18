const Partner = require("../models/Paartner");
const PartnerProfile = require("../models/PartnerProfile");
const PartnerWallet = require("../models/PartnerWallet");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../utils/sendOTP");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const path = require("path");
const ServiceCategory = require("../models/ServiceCategory");
const SubCategory = require("../models/SubCategory");
const Service = require("../models/Service");
const mongoose = require("mongoose");
// Send OTP for partner login/registration
exports.sendLoginOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Try to find partner by phone
    let partner = await Partner.findOne({ phone });
    if (!partner) {
      // If partner does not exist, create a new partner record.
      partner = new Partner({ phone });
      await partner.save();
      console.log("New partner created for phone:", phone);
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    // Save OTP and expiry
    partner = await Partner.findOneAndUpdate(
      { phone },
      {
        $set: {
          tempOTP: otp,
          otpExpiry: otpExpiry,
        },
      },
      { new: true }
    );

    // Send OTP via SMS
    await sendOTP(phone, otp);

    // Debug log
    console.log("Generated OTP:", { phone, otp, expiry: otpExpiry });

    res.json({
      success: true,
      message: "OTP sent successfully",
      phone,
      otp,
    });
  } catch (error) {
    console.error("Send Partner OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending OTP",
    });
  }
};

// Verify OTP and login partner
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Phone and OTP are required" });
    }

    // Debug log
    console.log("Verifying OTP:", { phone, otp });

    const partner = await Partner.findOne({ phone }).select(
      "+tempOTP +otpExpiry"
    );

    // Debug log
    console.log("Found Partner:", partner);
    if (!partner) {
      return res
        .status(400)
        .json({ success: false, message: "Partner not found" });
    }

    console.log("Stored OTP:", partner.tempOTP, "Entered OTP:", otp);
    console.log(
      "Stored OTP Expiry:",
      partner.otpExpiry,
      "Current Time:",
      new Date()
    );

    // Check if OTP is expired
    if (!partner.otpExpiry || partner.otpExpiry < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    // Verify OTP (convert to string before comparison)
    if (partner.tempOTP?.toString() !== otp.toString()) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Clear OTP fields after successful verification
    partner.tempOTP = undefined;
    partner.otpExpiry = undefined;
    partner.markModified("tempOTP");
    partner.markModified("otpExpiry");
    await partner.save();

    // Generate JWT token
    const token = jwt.sign({ id: partner._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    // Ensure all required fields are included in the response
    res.json({
      success: true,
      message: "Login successful",
      partner: {
        _id: partner._id,
        partnerId: partner.partnerId, // Ensure this field exists in the database
        phone: partner.phone,
        name: partner.name,
        email: partner.email,
        whatsappNumber: partner.whatsappNumber,
        qualification: partner.qualification,
        experience: partner.experience,
        contactNumber: partner.contactNumber,
        address: partner.address,
        landmark: partner.landmark,
        pincode: partner.pincode,
        category: partner.category, // Ensure this field exists
        subcategory: partner.subcategory, // Ensure this field exists
        service: partner.service, // Ensure this field exists
        modeOfService: partner.modeOfService, // Ensure this field exists
        status: partner.status,
        kycStatus: partner.kycStatus,
        profileCompleted: partner.profileCompleted,
        profile: partner.profile,
        token,
        profilePicture: partner.profilePicture,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
    });
  }
};

// Resend OTP for partner
exports.resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const partner = await Partner.findOne({ phone });
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save new OTP
    await Partner.findOneAndUpdate(
      { phone },
      {
        $set: {
          tempOTP: otp,
          otpExpiry: otpExpiry,
        },
      },
      { new: true }
    );

    // Send OTP via SMS
    await sendOTP(phone, otp);

    res.json({
      success: true,
      message: "OTP resent successfully",
      phone,
    });
  } catch (error) {
    console.error("Resend Partner OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Error resending OTP",
    });
  }
};

// Complete partner profile

exports.completeProfile = async (req, res) => {
  try {
    console.log("Received request body:", req.body);
    console.log("Received file:", req.file);

    const {
      name,
      email,
      whatsappNumber,
      qualification,
      experience,
      contactNumber,
      address,
      landmark,
      pincode,
    } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Name and Email are required" });
    }

    // 📂 Handle file upload
    const profilePicturePath = req.file ? req.file.path.split("/").pop() : null;

    // 🆕 Create the new Partner (without requiring category, subcategory, etc.)
    // const newPartner = new Partner({
    //   // phone: contactNumber,
    //   profileCompleted: false, // Will be updated in another API
    //   profile: { name, email },
    //   whatsappNumber,
    //   qualification,
    //   experience,
    //   profilePicture: profilePicturePath,
    // });
    const updatedPartner = await Partner.findOneAndUpdate(
      { phone: contactNumber }, // Find by phone number
      {
        $set: {
          profileCompleted: false, // Will be updated in another API
          profile: { name, email, address, landmark, pincode },
          whatsappNumber,
          qualification,
          experience,
          profilePicture: profilePicturePath,
        },
      },
      { new: true, upsert: false } // Return updated document, don't create a new one
    );

    // await newPartner.save();
    if (!updatedPartner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Partner updated successfully",
      data: updatedPartner,
    });

    // return res.status(201).json({ success: true, message: "Profile created successfully", data: newPartner });
  } catch (error) {
    console.error("Complete Profile Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//select service and category
exports.selectCategoryAndServices = async (req, res) => {
  try {
    const { partnerId, category, subcategory, service, modeOfService } =
      req.body;

    if (!partnerId || !category || !subcategory || !service || !modeOfService) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Log received data for debugging
    console.log("Received data:", req.body);

    // ✅ Validate category
    const validCategory = await ServiceCategory.findById(category);
    if (!validCategory) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category ID" });
    }

    // ✅ Validate subcategory
    const validSubcategory = await SubCategory.findOne({
      _id: subcategory,
      category,
    });
    if (!validSubcategory) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subcategory ID" });
    }

    // ✅ Validate services under the selected subcategory
    let serviceIds = Array.isArray(service) ? service : JSON.parse(service);
    console.log("Service IDs to check:", serviceIds);

    // const validServices = await Service.find({ _id: { $in: serviceIds }, subcategory });
    const validServices = await Service.find({
      _id: { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
      subCategory: subcategory,
    });

    console.log("Valid services found:", validServices);

    if (validServices.length !== serviceIds.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid service IDs",
        details: {
          requested: serviceIds,
          found: validServices.map((s) => s._id),
        },
      });
    }

    // ✅ Update partner profile
    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      {
        category,
        subcategory,
        service: serviceIds,
        modeOfService,
        profileCompleted: true, // Mark profile as complete
      },
      { new: true }
    );

    if (!updatedPartner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedPartner,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Update KYC details
exports.updateKYC = async (req, res) => {
  try {
    const {
      panNumber,
      panImage,
      aadhaarNumber,
      aadhaarFrontImage,
      aadhaarBackImage,
    } = req.body;

    // Validate required fields
    if (
      !panNumber ||
      !panImage ||
      !aadhaarNumber ||
      !aadhaarFrontImage ||
      !aadhaarBackImage
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all KYC details",
      });
    }

    const profile = await PartnerProfile.findOne({ partner: req.partner._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Update KYC details
    profile.kyc = {
      panCard: {
        number: panNumber,
        image: panImage,
        verified: "pending",
      },
      aadhaarCard: {
        number: aadhaarNumber,
        frontImage: aadhaarFrontImage,
        backImage: aadhaarBackImage,
        verified: "pending",
      },
    };

    await profile.save();

    res.json({
      success: true,
      message: "KYC details updated successfully",
      kyc: profile.kyc,
    });
  } catch (error) {
    console.error("Update KYC Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating KYC details",
    });
  }
};

// Update bank details
exports.updateBankDetails = async (req, res) => {
  try {
    const {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      chequeImage,
    } = req.body;

    // Validate required fields
    if (
      !accountNumber ||
      !ifscCode ||
      !accountHolderName ||
      !bankName ||
      !chequeImage
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all bank details",
      });
    }

    const profile = await PartnerProfile.findOne({ partner: req.partner._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Update bank details
    profile.bankDetails = {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      chequeImage,
      verified: "pending",
    };

    await profile.save();

    res.json({
      success: true,
      message: "Bank details updated successfully",
      bankDetails: profile.bankDetails,
    });
  } catch (error) {
    console.error("Update Bank Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating bank details",
    });
  }
};

// Complete KYC
exports.completeKYC = async (req, res) => {
  try {
    const { accountNumber, ifscCode, accountHolderName, bankName } = req.body;

    // Log received body data
    console.log("Body received:", req.body);

    // Log received files to debug missing fields
    console.log("Uploaded Files:", req.files);

    // Extract filenames safely
    const panCard = req.files?.panCard?.[0]?.filename || null;
    const aadhaar = req.files?.aadhaar?.[0]?.filename || null;
    const chequeImage = req.files?.chequeImage?.[0]?.filename || null;

    // Validate required fields
    if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required bank details.",
      });
    }

    if (!panCard || !aadhaar || !chequeImage) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload all required documents (PAN, Aadhaar, Cheque Image).",
      });
    }

    // Fetch partner profile
    console.log("Partner ID:", req.partner._id);
    const profile = await Partner.findById(req.partner._id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Partner profile not found.",
      });
    }

    // Update KYC details
    profile.kyc = {
      panCard,
      aadhaar,
      chequeImage,
      status: "pending", // Initial status
      remarks: null, // Clear previous remarks
    };

    // Update bank details
    profile.bankDetails = {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      chequeImage,
    };

    // Save profile
    await profile.save();

    // Log the updated profile
    console.log("Updated KYC Profile:", profile.kyc);

    res.json({
      success: true,
      message: "KYC documents uploaded successfully. Pending admin approval.",
      profile: {
        ...profile.toObject(),
        kyc: {
          status: profile.kyc.status,
          remarks: profile.kyc.remarks,
          panCard,
          aadhaar,
        },
      },
    });
  } catch (error) {
    console.error("Complete KYC Error:", error);
    res.status(500).json({
      success: false,
      message: "Error completing KYC",
      error: error.message,
    });
  }
};

// New endpoint for admin to update KYC status
exports.updateKYCStatus = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { status, remarks } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'pending', 'approved', or 'rejected'",
      });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    // Update KYC status
    partner.kyc.status = status;
    partner.kyc.remarks = remarks || null;

    await partner.save();

    res.json({
      success: true,
      message: `KYC ${status} successfully`,
      kyc: {
        status: partner.kyc.status,
        remarks: partner.kyc.remarks,
      },
    });
  } catch (error) {
    console.error("Update KYC Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating KYC status",
      error: error.message,
    });
  }
};

// Get partner profile
exports.getProfile = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is missing",
      });
    }

    console.log(
      "Partner ID:",
      req.partner._id,
      "Type:",
      typeof req.partner._id
    );

    const partnerId = new mongoose.Types.ObjectId(req.partner._id);

    const profile = await Partner.findOne({ _id: partnerId })
      .populate("category", "name description")
      .populate("service", "name description basePrice duration");

    console.log("Fetched Profile:", profile);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      profile: {
        id: profile._id,
        name: profile.profile?.name || "N/A",
        email: profile.profile?.email || "N/A",
        phone: profile.phone,
        whatsappNumber: profile.whatsappNumber,
        qualification: profile.qualification,
        experience: profile.experience,
        category: profile.category,
        service: profile.service,
        modeOfService: profile.modeOfService,
        profilePicture: profile.profilePicture,
        status: profile.profileCompleted ? "Completed" : "Incomplete",
      },
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

exports.getAllPartnerProfile = async (req, res) => {
  try {
    const allPartners = await PartnerProfile.find();
    return res.status(200).json({
      success: false,
      message: "Profile not found",
      data: allPartners,
    });
  } catch (err) {
    console.log("Error Occured : ", err);
  }
};

// Update partner profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      whatsappNumber,
      contactNumber,
      qualification,
      experience,
      category,
      service,
      modeOfService,
    } = req.body;

    let profile = await Partner.findOne({ _id: req.partner._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Check if profilePicture is uploaded in form-data
    const profilePicture = req.file ? req.file.filename : undefined;

    // Update only provided fields (Handle both JSON & form-data)
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (whatsappNumber) updatedFields.whatsappNumber = whatsappNumber;
    if (contactNumber) updatedFields.contactNumber = contactNumber;
    if (qualification) updatedFields.qualification = qualification;
    if (experience) updatedFields.experience = parseFloat(experience);
    if (category) updatedFields.category = category;
    if (service) updatedFields.service = service;
    if (modeOfService) updatedFields.modeOfService = modeOfService;
    if (profilePicture) updatedFields.profilePicture = profilePicture;

    // Apply updates to the profile
    Object.assign(profile, updatedFields);
    await profile.save();

    // Populate category and service details
    await profile.populate("category", "name description");
    await profile.populate("service", "name description basePrice duration");

    res.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: profile._id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        whatsappNumber: profile.whatsappNumber,
        contactNumber: profile.contactNumber,
        qualification: profile.qualification,
        experience: profile.experience,
        category: profile.category,
        service: profile.service,
        modeOfService: profile.modeOfService,
        profilePicture: profile.profilePicture,
        verificationStatus: profile.verificationStatus,
        status: profile.status,
        dutyStatus: profile.dutyStatus,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

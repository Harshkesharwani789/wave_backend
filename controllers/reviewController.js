const Review = require("../models/Review");
const User = require("../models/User");
const Booking = require("../models/booking");
const SubService = require("../models/SubService");
const Wallet = require("../models/Wallet");
const { v4: uuidv4 } = require("uuid");
const Partner = require("../models/Paartner");
const Contact = require("../models/Contact");

// Submit a new review
// Submit a new review
exports.submitReview = async (req, res) => {
  const { user, subService, rating, comment } = req.body;
  console.log(user, subService, rating, comment, "testing");

  try {
    // Check if the user has already reviewed this subService
    const existingReview = await Review.findOne({ user, subService });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a review for this sub-service.",
      });
    }

    // Create and save the new review
    const review = new Review({ user, subService, rating, comment });
    await review.save();

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(400).json({
      success: false,
      message: "Error submitting review",
      error: error.message,
    });
  }
};

// Get reviews for a specific subservice

exports.getReviews = async (req, res) => {
  const { subServiceId } = req.params;
  try {
    const reviews = await Review.find({ subService: subServiceId }).populate(
      "user",
      "name"
    );
    res.status(200).json(reviews);
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error retrieving reviews", error: error.message });
  }
};

exports.topUpWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.json({ balance: wallet.balance, transactions: wallet.transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.transactionsWallet = async (req, res) => {
  try {
    const { userId, amount, type } = req.body;

    if (!userId || !amount || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] });
    }

    if (type === "Debit" && wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const newTransaction = {
      transactionId: uuidv4(),
      amount,
      type,
    };

    wallet.transactions.push(newTransaction);
    wallet.balance += type === "Credit" ? amount : -amount;

    await wallet.save();

    res.status(201).json({ message: "Transaction successful", wallet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// // Function to get all reviews
// exports.getAllReviews = async (req, res) => {
//     try {
//         const reviews = await Review.find(); // Fetch all reviews from the database
//         res.status(200).json(reviews);
//     } catch (error) {
//         res.status(500).json({ message: 'Error fetching reviews', error });
//     }
// };

// Get all reviews
// Get all reviews
// Get all reviews
// exports.getAllReviews = async (req, res) => {
//     try {
//         const reviews = await Review.find()
//             .populate('user', 'name email') // Populate user details
//             .populate({
//                 path: 'booking',
//                 populate: [
//                     { path: 'subService', select: 'name description' }, // Populate sub-service from booking
//                     { path: 'partner', select: 'name contact' } // Populate partner from booking
//                 ]
//             })
//             .lean(); // Convert to plain JS objects for better performance

//         return res.status(200).json({
//             success: true,
//             count: reviews.length,
//             data: reviews.map(review => ({
//                 user: {
//                     name: review.user?.name || 'N/A',
//                     email: review.user?.email || 'N/A'
//                 },
//                 booking: {
//                     id: review.booking?._id || 'N/A',
//                     date: review.booking?.date || 'N/A',
//                     status: review.booking?.status || 'N/A'
//                 },
//                 subService: {
//                     id: review.booking?.subService?._id || 'N/A',
//                     name: review.booking?.subService?.name || 'N/A',
//                     description: review.booking?.subService?.description || 'N/A'
//                 },
//                 partner: {
//                     id: review.booking?.partner?._id || 'N/A',
//                     name: review.booking?.partner?.name || 'N/A',
//                     contact: review.booking?.partner?.contact || 'N/A'
//                 },
//                 rating: review.rating,
//                 comment: review.comment,
//                 createdAt: review.createdAt
//             }))
//         });
//     } catch (error) {
//         console.error('Error fetching reviews:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error fetching reviews',
//             error: error.message
//         });
//     }
// };

// Get all reviews for Admin
// exports.getAllReviewsForAdmin = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 10;
//         const skip = (page - 1) * limit;

//         const filter = {};
//         if (req.query.userId) filter.user = req.query.userId;
//         if (req.query.partnerId) filter['booking.partner'] = req.query.partnerId;

//         const reviews = await Review.find(filter)
//             .populate('user', 'name email') // Populate user details
//             .populate({
//                 path: 'booking',
//                 populate: [
//                     { path: 'subService', select: 'name description' }, // Populate sub-service from booking
//                     { path: 'partner', select: 'name contact' } // Populate partner from booking
//                 ]
//             })
//             .sort({ createdAt: -1 }) // Sort by latest reviews first
//             .skip(skip)
//             .limit(limit)
//             .lean();

//         const totalReviews = await Review.countDocuments(filter); // Get total count for pagination

//         return res.status(200).json({
//             success: true,
//             count: reviews.length,
//             totalReviews,
//             currentPage: page,
//             totalPages: Math.ceil(totalReviews / limit),
//             data: reviews.map(review => ({
//                 user: {
//                     name: review.user?.name || 'N/A',
//                     email: review.user?.email || 'N/A'
//                 },
//                 booking: {
//                     id: review.booking?._id || 'N/A',
//                     date: review.booking?.date || 'N/A',
//                     status: review.booking?.status || 'N/A'
//                 },
//                 subService: {
//                     id: review.booking?.subService?._id || 'N/A',
//                     name: review.booking?.subService?.name || 'N/A',
//                     description: review.booking?.subService?.description || 'N/A'
//                 },
//                 partner: {
//                     id: review.booking?.partner?._id || 'N/A',
//                     name: review.booking?.partner?.name || 'N/A',
//                     contact: review.booking?.partner?.contact || 'N/A'
//                 },
//                 rating: review.rating,
//                 comment: review.comment,
//                 createdAt: review.createdAt
//             }))
//         });
//     } catch (error) {
//         console.error('Error fetching reviews for admin:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error fetching reviews',
//             error: error.message
//         });
//     }
// };

// Get all reviews for Admin with partner details

exports.getAllReviewsForAdminWithPartnerDetails = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("subService", "name") // Populate sub-service name
      .populate({
        path: "partner",
        select: "name email phone address", // Populate partner/provider details
      })
      .lean(); // Convert to plain JS objects for better performance

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment,
        subServiceName: review.subService?.name || "N/A",
        partner: review.partner,
      })),
    });
  } catch (error) {
    console.error("Error fetching admin reviews with partner details:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching admin reviews with partner details",
      error: error.message,
    });
  }
};

// Review partner
exports.reviewPartner = async (req, res) => {
  try {
    const { bookingId, partnerId, rating, comment } = req.body;
    const userId = req.user._id;

    // Check if the booking exists and belongs to the user
    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
      partner: partnerId,
      status: "completed",
    });

    if (!booking) {
      return res
        .status(400)
        .json({ message: "Invalid booking or booking not completed." });
    }

    // Find the partner
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found." });
    }

    // Check if the user has already reviewed this partner
    const existingReview = partner.reviews.find(
      (review) => review.user.toString() === userId.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        message: "You have already submitted a review for this partner.",
      });
    }

    // Create review object
    const review = {
      user: userId,
      booking: bookingId,
      partner: partnerId,
      rating,
      comment,
      createdAt: new Date(),
    };

    // Push review into the partner's reviews array
    partner.reviews.push(review);
    await partner.save();

    res.status(201).json({ message: "Review submitted successfully!", review });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

exports.ContactUs = async (req, res) => {
  try {
    const { fullName, email, phone, message } = req.body;

    if (!fullName || !email || !phone || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newContact = new Contact({ fullName, email, phone, message });
    await newContact.save();

    res.status(201).json({ message: "Your query has been sent successfully!" });
  } catch (error) {
    console.error("Error saving contact form data:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
};

exports.getAllContactUs = async (req, res) => {
  try {
    // const { fullName, email, phone, message } = req.body;

    // if (!fullName || !email || !phone || !message) {
    //   return res.status(400).json({ error: "All fields are required" });
    // }

    // const newContact = new Contact({ fullName, email, phone, message });
    // await newContact.save();
    const allContacts = await Contact.find();

    res.status(201).json({ data: allContacts });
  } catch (error) {
    console.error("Error fetching contact  data:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
};

const Partner = require("../models/Paartner");
const PartnerLocation = require("../models/Partnerlocation");
const PartnerService = require("../models/PartnerService");

exports.searchPartners = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 5, // default 5km
      categoryId,
      serviceId,
    } = req.query;

    // Validate required parameters
    if (!latitude || !longitude || !categoryId || !serviceId) {
      return res.status(400).json({
        message: "Missing required parameters",
      });
    }

    // Convert radius from kilometers to meters
    const radiusInMeters = radius * 1000;

    // Find partners within radius who offer the service
    const nearbyPartners = await PartnerLocation.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: "distance",
          maxDistance: radiusInMeters,
          spherical: true,
        },
      },
      {
        $match: {
          status: "online",
        },
      },
      {
        $lookup: {
          from: "partners",
          localField: "partner",
          foreignField: "_id",
          as: "partnerDetails",
        },
      },
      {
        $unwind: "$partnerDetails",
      },
      {
        $lookup: {
          from: "partnerservices",
          let: { partnerId: "$partner" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$partner", "$$partnerId"] },
                    { $eq: ["$category", mongoose.Types.ObjectId(categoryId)] },
                    { $eq: ["$service", mongoose.Types.ObjectId(serviceId)] },
                    { $eq: ["$status", "active"] },
                  ],
                },
              },
            },
          ],
          as: "serviceDetails",
        },
      },
      {
        $match: {
          "serviceDetails.0": { $exists: true },
        },
      },
      {
        $project: {
          _id: 0,
          partnerId: "$partner",
          name: "$partnerDetails.profile.name",
          experience: "$partnerDetails.profile.experience",
          rating: "$partnerDetails.rating",
          price: { $arrayElemAt: ["$serviceDetails.price", 0] },
          distance: { $round: ["$distance", 2] },
          profilePicture: "$partnerDetails.profile.profilePicture",
        },
      },
      {
        $sort: { distance: 1 },
      },
    ]);

    res.json({
      partners: nearbyPartners,
      count: nearbyPartners.length,
      searchParams: {
        latitude,
        longitude,
        radius,
        categoryId,
        serviceId,
      },
    });
  } catch (error) {
    console.error("Partner Search Error:", error);
    res.status(500).json({ message: "Error searching partners" });
  }
};

// Add method to update partner location
exports.updatePartnerLocation = async (req, res) => {
  try {
    const { latitude, longitude, status } = req.body;

    let partnerLocation = await PartnerLocation.findOne({
      partner: req.partner._id,
    });

    if (!partnerLocation) {
      partnerLocation = new PartnerLocation({
        partner: req.partner._id,
      });
    }

    partnerLocation.location = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };
    partnerLocation.status = status || partnerLocation.status;
    partnerLocation.lastUpdated = new Date();

    await partnerLocation.save();

    res.json({
      message: "Location updated successfully",
      location: {
        coordinates: partnerLocation.location.coordinates,
        status: partnerLocation.status,
        lastUpdated: partnerLocation.lastUpdated,
      },
    });
  } catch (error) {
    console.error("Update Location Error:", error);
    res.status(500).json({ message: "Error updating location" });
  }
};

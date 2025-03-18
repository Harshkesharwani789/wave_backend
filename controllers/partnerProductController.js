const PartnerProduct = require("../models/PartnerProduct");
const { errorHandler } = require("../utils/errorHandler");

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { name, price, quantity, description } = req.body;

    const product = await PartnerProduct.create({
      partner: req.partner._id,
      name,
      price,
      unit: quantity,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get all products for a partner
exports.getPartnerProducts = async (req, res) => {
  try {
    const products = await PartnerProduct.find({ partner: req.partner._id });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get single product
exports.getProduct = async (req, res) => {
  try {
    const product = await PartnerProduct.findOne({
      _id: req.params.id,
      partner: req.partner._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { name, price, quantity, description } = req.body;

    const product = await PartnerProduct.findOneAndUpdate(
      { _id: req.params.id, partner: req.partner._id },
      {
        name,
        price,
        unit: quantity,
        description,
      },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await PartnerProduct.findOneAndDelete({
      _id: req.params.id,
      partner: req.partner._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

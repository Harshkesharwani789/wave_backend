const Partner = require("../models/Paartner");
const Booking = require("../models/booking");
const SubService = require("../models/SubService");
const Wallet = require("../models/Wallet");
const { v4: uuidv4 } = require("uuid");

exports.topUpWallet = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { amount } = req.body;
    console.log("req params", req.params);
    console.log("req body", req.body);
    if (!partnerId || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let wallet = await Wallet.findOne({ partnerId });

    if (!wallet) {
      wallet = new PartnerWallet({ partnerId, balance: 0, transactions: [] });
    }

    // Check for sufficient balance on debit
    if (type === "Debit" && wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Create new transaction
    const newTransaction = {
      transactionId: uuidv4(),
      amount,
      type,
      date: new Date(),
    };

    // Update wallet balance and transactions
    wallet.transactions.push(newTransaction);
    wallet.balance += type === "Credit" ? amount : -amount;

    // Save wallet
    await wallet.save();

    res.status(201).json({ message: "Transaction successful", wallet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.transactionsWallet = async (req, res) => {
  try {
    const { partnerId, amount, type } = req.body;
    console.log("req body", partnerId, amount, type);
    if (!partnerId || !amount || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Retrieve partner wallet
    const wallet = await PartnerWallet.findOne({ partnerId });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Return transactions
    res.status(200).json({ transactions: wallet.transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

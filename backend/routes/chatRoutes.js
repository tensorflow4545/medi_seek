const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Message = require("../models/Message");
const { encryptMessage, decryptMessage } = require("../utils/encrypt");

const GOOGLE_GEN_AI_KEY =
  process.env.GOOGLE_GEN_AI_KEY || "AIzaSyC2ATEyBpS31Iqjwqi4ry8GgtS4Ryzw2wc";

let geminiModel;

try {
  const genAI = new GoogleGenerativeAI(GOOGLE_GEN_AI_KEY);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
} catch (error) {
  console.error("Failed to initialize Gemini model:", error.message);
}

router.post("/send", async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;

    // 🔒 Encrypt the message before storing
    const encryptedMessage = encryptMessage(message);

    // ✅ Save the message with any senderId and receiverId
    const newMessage = new Message({ senderId, receiverId, message: encryptedMessage });
    await newMessage.save();

    res.status(201).json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ask", async (req, res) => {
  try {
    const { pdfUrl, question } = req.body;

    if (!question || !question.trim()) {
      return res
        .status(400)
        .json({ message: "A question is required to generate a response." });
    }

    if (!geminiModel) {
      return res.status(503).json({
        message: "Gemini model is not available. Please try again later.",
      });
    }

    let extractedContent = "";

    if (pdfUrl && typeof pdfUrl === "string") {
      try {
        const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
        const fileBuffer = Buffer.from(response.data);
        const normalizedUrl = pdfUrl.toLowerCase();

        if (normalizedUrl.endsWith(".pdf")) {
          const pdfData = await pdfParse(fileBuffer);
          extractedContent = pdfData.text || "";
        } else if (
          normalizedUrl.endsWith(".jpg") ||
          normalizedUrl.endsWith(".jpeg") ||
          normalizedUrl.endsWith(".png")
        ) {
          const { data } = await Tesseract.recognize(fileBuffer, "eng");
          extractedContent = data.text || "";
        } else {
          extractedContent = "";
        }
      } catch (error) {
        console.error("Failed to fetch or parse document:", error.message);
        extractedContent = "";
      }
    }

    const truncatedContent = extractedContent.trim().slice(0, 15000);

    const prompt = `
You are a helpful and precise medical assistant. Use the provided document text (if any) to answer the user's question. 
If the document does not contain the answer, rely on general medical knowledge but mention the limitation.

Document content:
${truncatedContent || "[No readable content extracted from the provided document.]"}

Question:
${question}
`;

    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const answer =
      result?.response?.text?.() ??
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "I'm sorry, but I could not generate a response.";

    res.json({ answer: answer.trim() });
  } catch (error) {
    console.error("Error generating chat response:", error);

    const statusCode = error?.response?.status ?? 500;
    const message =
      error?.response?.data?.error ??
      error?.message ??
      "Failed to generate response.";

    res
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .json({
        message: "Failed to generate response.",
        details: message,
      });
  }
});

// ✅ Get chat history (No user validation required)
router.get("/history/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;

    // Fetch chat messages between two users (regardless of user existence)
    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).sort({ createdAt: 1 });

    // 🔓 Decrypt messages before sending
    const decryptedMessages = messages.map((msg) => ({
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: decryptMessage(msg.message),
      createdAt: msg.createdAt,
    }));

    res.status(200).json(decryptedMessages);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
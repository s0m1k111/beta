const express = require("express");
const router = express.Router();

const authCheck = require("../../middleware/authCheck");
const friendController = require("./friendController");

router.post("/send", authCheck, friendController.sendRequest);
router.post("/accept", authCheck, friendController.acceptRequest);
router.post("/decline", authCheck, friendController.declineRequest);
router.post("/remove", authCheck, friendController.removeFriend);

router.get("/list", authCheck, friendController.getFriends);
router.get("/incoming", authCheck, friendController.getIncoming);
router.get("/outgoing", authCheck, friendController.getOutgoing);

router.get("/status/:id", authCheck, friendController.getStatus);

module.exports = router;

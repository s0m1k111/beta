const express = require("express");
const router = express.Router();
const authCheck = require("../../middleware/authCheck");
const dmController = require("./dmController");

router.post("/open", authCheck, dmController.openChat);
router.post("/send", authCheck, dmController.sendMessage);
router.get("/list", authCheck, dmController.listChats);

// Редактирование/удаление — ДО /:chatId
router.put("/msg/:messageId/edit", authCheck, dmController.editMessage);
router.delete("/msg/:messageId/delete", authCheck, dmController.deleteMessage);

// Реакции
router.post("/msg/:messageId/react/:emoji", authCheck, dmController.addReaction);
router.delete("/msg/:messageId/react/:emoji", authCheck, dmController.removeReaction);

router.get("/:chatId/messages", authCheck, dmController.getMessages);

module.exports = router;

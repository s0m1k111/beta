const express = require("express");
const router = express.Router();

const authCheck = require("../../middleware/authCheck");
const dmController = require("./dmController");

// Создать или получить чат
router.post("/open", authCheck, dmController.openChat);

// Отправить сообщение
router.post("/send", authCheck, dmController.sendMessage);

// Получить историю сообщений
router.get("/:chatId/messages", authCheck, dmController.getMessages);

// Получить список чатов
router.get("/list", authCheck, dmController.listChats);

module.exports = router;

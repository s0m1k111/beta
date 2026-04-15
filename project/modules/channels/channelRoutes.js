const express = require("express");
const router = express.Router();
const authCheck = require("../../middleware/authCheck");
const channelController = require("./channelController");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");

const UPLOAD_DIR = path.join(__dirname, "../../../uploads/channel_images/");
fs.ensureDirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype.split("/")[1]);
  if (ext || mime) cb(null, true);
  else cb(new Error("Разрешены только изображения: jpeg, jpg, png, gif, webp"), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Создать канал на сервере
router.post("/:serverId/channels", authCheck, channelController.createChannel);

// Удалить канал
router.delete("/:serverId/channels/:channelId", authCheck, channelController.deleteChannel);

// Переименовать канал
router.put("/:serverId/channels/:channelId", authCheck, channelController.renameChannel);

// Получить сообщения канала
router.get("/channels/:channelId/messages", authCheck, channelController.getMessages);

// Отправить сообщение в канал
router.post("/channels/send", authCheck, channelController.sendMessage);

// Редактировать сообщение
router.put("/channels/:channelId/messages/:messageId", authCheck, channelController.editMessage);

// Удалить сообщение
router.delete("/channels/:channelId/messages/:messageId", authCheck, channelController.deleteMessage);

// Реакции
router.post("/channels/:channelId/messages/:messageId/react/:emoji", authCheck, channelController.addReaction);
router.delete("/channels/:channelId/messages/:messageId/react/:emoji", authCheck, channelController.removeReaction);

// Загрузка изображения
router.post("/upload", authCheck, upload.single("image"), channelController.uploadImage);

// Отметить как прочитанное
router.post("/read", authCheck, channelController.markAsRead);

// Получить сводку непрочитанных
router.get("/unread", authCheck, channelController.getUnreadSummary);

module.exports = router;

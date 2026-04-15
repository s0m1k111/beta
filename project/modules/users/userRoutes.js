const express = require("express");
const router = express.Router();

const userController = require("./userController");
const authCheck = require("../../middleware/authCheck");

const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");

// Гарантированно создаём папку
const AVATAR_DIR = path.join(__dirname, "../../../uploads/avatars/");
fs.ensureDirSync(AVATAR_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype.split("/")[1]);
  if (ext || mime) {
    cb(null, true);
  } else {
    cb(new Error("Разрешены только изображения: jpeg, jpg, png, gif, webp"), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Получить профиль текущего пользователя
router.get("/profile", authCheck, userController.getProfile);

// Обновить профиль текущего пользователя
router.put("/profile", authCheck, userController.updateProfile);

// Ищем человека
router.get("/search", authCheck, userController.searchUsers);

// Получить пользователя по ID
router.get("/:id", authCheck, userController.getUserById);

router.post("/avatar", authCheck, upload.single("avatar"), userController.uploadAvatar);

module.exports = router;

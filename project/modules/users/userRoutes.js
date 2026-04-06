const express = require("express");
const router = express.Router();

const userController = require("./userController");
const authCheck = require("../../middleware/authCheck");

// Получить профиль текущего пользователя
router.get("/profile", authCheck, userController.getProfile);

// Обновить профиль текущего пользователя
router.put("/profile", authCheck, userController.updateProfile);

// Ищем человека
router.get("/search", authCheck, userController.searchUsers);

// Получить пользователя по ID
router.get("/:id", authCheck, userController.getUserById);

module.exports = router;

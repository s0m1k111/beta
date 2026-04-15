const express = require("express");
const router = express.Router();
const authCheck = require("../../middleware/authCheck");
const serverController = require("./serverController");

// Получить мои серверы
router.get("/my", authCheck, serverController.getMyServers);

// Создать сервер
router.post("/create", authCheck, serverController.createServer);

// Получить сервер по ID
router.get("/:id", authCheck, serverController.getServer);

// Присоединиться к серверу
router.post("/join", authCheck, serverController.joinServer);

// Покинуть сервер
router.post("/leave", authCheck, serverController.leaveServer);

// Удалить сервер
router.post("/delete", authCheck, serverController.deleteServer);

// Получить участников сервера
router.get("/:id/members", authCheck, serverController.getMembers);

// Изменить роль участника
router.put("/:serverId/role", authCheck, serverController.changeRole);

module.exports = router;

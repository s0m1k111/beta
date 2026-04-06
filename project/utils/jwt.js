const jwt = require("jsonwebtoken");
const path = require("path");
const secrets = require("../config/secrets");

/**
 * Создаёт JWT токен
 */
function sign(payload) {
  return jwt.sign(payload, secrets.JWT_SECRET, {
    expiresIn: "30d", // токен живёт 30 дней
  });
}

/**
 * Проверяет JWT токен
 */
function verify(token) {
  try {
    return jwt.verify(token, secrets.JWT_SECRET);
  } catch (err) {
    return null; // если токен неверный или истёк
  }
}

module.exports = {
  sign,
  verify,
};

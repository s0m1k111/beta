const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

/**
 * Хеширует пароль
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Сравнивает пароль с хешем
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
};

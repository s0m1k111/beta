/**
 * Проверяет email
 */
function validateEmail(email) {
  if (!email) return "Email обязателен";
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) ? true : "Некорректный email";
}

/**
 * Проверяет пароль
 */
function validatePassword(password) {
  if (!password) return "Пароль обязателен";
  if (password.length < 6) return "Пароль должен быть минимум 6 символов";
  return true;
}

/**
 * Проверяет имя пользователя
 */
function validateUsername(username) {
  if (!username) return "Имя пользователя обязательно";
  if (username.length < 3) return "Имя должно быть минимум 3 символа";
  if (username.length > 20) return "Имя слишком длинное";
  return true;
}

/**
 * Проверяет текст сообщения
 */
function validateMessage(text) {
  if (!text) return "Сообщение пустое";
  if (text.length > 5000) return "Сообщение слишком длинное";
  return true;
}

module.exports = {
  validateEmail,
  validatePassword,
  validateUsername,
  validateMessage,
};

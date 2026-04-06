const authService = require("./authService");

/**
 * Регистрация
 */
async function register(req, res) {
  const result = await authService.register(req.body);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
}

/**
 * Логин
 */
async function login(req, res) {
  const result = await authService.login(req.body);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
}

module.exports = {
  register,
  login,
};

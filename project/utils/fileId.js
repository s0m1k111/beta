const { v4: uuidv4 } = require("uuid");

/**
 * Генерирует уникальный ID с префиксом
 * Например: m_3f9a1c2e
 */
function generateId(prefix = "id") {
  const raw = uuidv4().split("-")[0]; // короткий UUID
  return `${prefix}_${raw}`;
}

module.exports = {
  generateId,
};

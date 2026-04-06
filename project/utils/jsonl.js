const fs = require("fs-extra");
const path = require("path");

/**
 * Читает JSONL файл и возвращает массив объектов
 */
async function readJSONL(filePath) {
  try {
    await fs.ensureFile(filePath);
    const data = await fs.readFile(filePath, "utf8");

    if (!data.trim()) return [];

    return data
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } catch (err) {
    console.error("Ошибка чтения JSONL:", err);
    return [];
  }
}

/**
 * Добавляет объект в конец JSONL файла
 */
async function appendJSONL(filePath, obj) {
  try {
    await fs.ensureFile(filePath);
    const line = JSON.stringify(obj) + "\n";
    await fs.appendFile(filePath, line, "utf8");
  } catch (err) {
    console.error("Ошибка записи JSONL:", err);
  }
}

/**
 * Полностью перезаписывает JSONL файл массивом объектов
 */
async function rewriteJSONL(filePath, array) {
  try {
    await fs.ensureFile(filePath);
    const lines = array.map((obj) => JSON.stringify(obj)).join("\n") + "\n";
    await fs.writeFile(filePath, lines, "utf8");
  } catch (err) {
    console.error("Ошибка перезаписи JSONL:", err);
  }
}

module.exports = {
  readJSONL,
  appendJSONL,
  rewriteJSONL,
};

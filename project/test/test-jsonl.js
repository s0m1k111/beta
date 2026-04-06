const { readJSONL, appendJSONL, rewriteJSONL } = require("../utils/jsonl");
const path = require("path");

const file = path.join(__dirname, "db/messages/test.jsonl");

async function test() {
  console.log("Добавляем сообщение...");
  await appendJSONL(file, { id: 1, text: "Привет!" });

  console.log("Читаем файл...");
  const data = await readJSONL(file);
  console.log(data);

  console.log("Перезаписываем файл...");
  await rewriteJSONL(file, [{ id: 2, text: "Новое сообщение" }]);

  console.log("Читаем снова...");
  const data2 = await readJSONL(file);
  console.log(data2);
}

test();

const { hashPassword, comparePassword } = require("../utils/hash");

async function test() {
  const password = "mypassword123";

  console.log("Хешируем...");
  const hash = await hashPassword(password);
  console.log("Хеш:", hash);

  console.log("Проверяем правильный пароль...");
  console.log(await comparePassword("mypassword123", hash)); // true

  console.log("Проверяем неправильный пароль...");
  console.log(await comparePassword("wrongpass", hash)); // false
}

test();

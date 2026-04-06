const auth = require("../modules/auth/authService");

async function test() {
  console.log("Регистрация:");
  const reg = await auth.register({
    email: "test@mail.com",
    username: "Pavel",
    password: "123456",
  });
  console.log(reg);

  console.log("\nЛогин:");
  const log = await auth.login({
    email: "test@mail.com",
    password: "123456",
  });
  console.log(log);
}

test();

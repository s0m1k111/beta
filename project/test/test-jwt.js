const { sign, verify } = require("../utils/jwt");

const token = sign({ id: "u_123", username: "Pavel" });

console.log("Токен:", token);

const decoded = verify(token);
console.log("Расшифровка:", decoded);

console.log("Проверка неверного токена:", verify("wrong.token.here"));

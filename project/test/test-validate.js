const v = require("../utils/validate");

console.log(v.validateEmail("test@mail.com"));
console.log(v.validateEmail("wrong-email"));

console.log(v.validatePassword("123456"));
console.log(v.validatePassword("123"));

console.log(v.validateUsername("Pavel"));
console.log(v.validateUsername("Pa"));

console.log(v.validateMessage("Привет!"));
console.log(v.validateMessage(""));

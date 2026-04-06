export function renderChatList(chats) {
  const container = document.getElementById("chatList");
  container.innerHTML = "";

  chats.forEach((chat) => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.chat = chat.chatId;

    const name = chat.partner ? chat.partner.username : "Неизвестный";
    const last = chat.lastMessage ? chat.lastMessage.text : "Нет сообщений";

    div.innerHTML = `
      <strong>${name}</strong><br>
      <span>${last}</span>
    `;

    container.appendChild(div);
  });
}

export function renderMessages(messages, partnerName) {
  const header = document.getElementById("chatHeader");
  const msgBox = document.getElementById("messages");
  const inputArea = document.getElementById("inputArea");

  // Обновляем заголовок
  header.innerHTML = `<h2>${partnerName}</h2>`;

  // Показываем поле ввода
  inputArea.classList.remove("hidden");

  // Очищаем сообщения
  msgBox.innerHTML = "";

  messages.forEach((msg) => {
    const div = document.createElement("div");
    const isYou = msg.senderName === "Вы";

    div.className = `message ${isYou ? "right" : "left"}`;
    div.innerHTML = `
      <strong>${msg.senderName}</strong>
      <p>${msg.text}</p>
    `;

    msgBox.appendChild(div);
  });

  msgBox.scrollTop = msgBox.scrollHeight;
}

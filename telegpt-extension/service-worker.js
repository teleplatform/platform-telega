chrome.runtime.onInstalled.addListener(() => {
  console.log("[TeleGPT Extension] installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PING") {
    sendResponse({ ok: true });
    return true;
  }

  sendResponse({ ok: false, reason: "unknown_message_type" });
  return true;
});
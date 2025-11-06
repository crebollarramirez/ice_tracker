export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
}

export async function shareReport(address, info) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Community Alert",
        text: `Report: ${address}\n${info}`,
        url: window.location.href,
      });
      return true;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
      return false;
    }
  } else {
    // Fallback: copy link
    return copyToClipboard(window.location.href);
  }
}

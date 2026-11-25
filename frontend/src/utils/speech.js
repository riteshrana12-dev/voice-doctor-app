export function speakText(text, { cancelCurrent = true, onStart, onEnd, onError } = {}) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd?.();
  };
  try {
    if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      onError?.("This browser does not support speech playback.");
      finish();
      return false;
    }

    const synthesis = window.speechSynthesis;
    if (cancelCurrent) synthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || "en-US";
    utterance.onend = finish;
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        onError?.(`Browser speech playback failed (${event.error}). Check the device's audio output and voice settings.`);
      }
      finish();
    };
    utterance.onstart = onStart || null;

    synthesis.speak(utterance);
    // Some browsers leave speech paused after canceling a previous utterance.
    window.setTimeout(() => {
      if (synthesis.paused) synthesis.resume();
    }, 100);
    return true;
  } catch (error) {
    onError?.(`Browser speech playback failed: ${error?.message || error}`);
    finish();
    return false;
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

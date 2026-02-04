// Updated handleMessageAudioChunk function
const handleMessageAudioChunk = async (data) => {
  console.log(
    "🎵 [ChatInterface] Received message audio chunk (deprecated - using native TTS):",
    data
  );

  // Since we're using native TTS instead of base64 audio chunks,
  // we only need to handle the text portion for TTS processing
  if (
    data.success &&
    data.data?.text &&
    ttsService &&
    isVoiceModeRef.current
  ) {
    console.log("🎤 Processing text for TTS with progressive accumulation:", data.data.text);
    // The StreamingTTSService will now handle progressive word accumulation
    // starting with 5 words and increasing by 2x each time
    await ttsService.processTextChunk(data.data.text, data.isComplete || false);
  } else if (data.data?.text) {
    // If no TTS or not in voice mode, just update streaming text
    console.log("📝 [ChatInterface] No TTS - updating text only");
    setStreamingResponse((prev) => prev + data.data.text);
  } else {
    console.warn(
      "⚠️ [ChatInterface] Received audio chunk with no usable text data:",
      data
    );
  }
};
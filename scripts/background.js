const GEMINI_API_KEY = "...";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

async function getWordInfoFromGemini(word) {
  if (!word || typeof word !== "string" || word.trim() === "") {
    return { error: true, message: "Invalid word input." };
  }

  const prompt = `
Analyze the English word: "${word}"

Identify its single most common meaning and provide the analysis STRICTLY in JSON format. The JSON object must have the following structure:
{
"word": "${word}",
"phonetic": "(IPA phonetic transcription if available, otherwise 'N/A')",
"partOfSpeech": "(The single most common part of speech, e.g., 'noun', 'verb')",
"definition_en": "(Clear English definition for this primary meaning)",
"translation_vi": "(Accurate Vietnamese translation of this primary English definition)",
"example_en": "(An English example sentence using the word with this primary meaning, or 'N/A')"
}

Constraints:
- Only output the raw JSON object. Do NOT include any introductory text, concluding remarks, explanations, or markdown formatting like \`\`\`json.
- Ensure all strings within the JSON are correctly escaped for valid JSON.
- If the word is not found or invalid, return a JSON object: {"error": "Word not found or invalid."}
`;

  const generationConfig = {
    response_mime_type: "application/json",
  };

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: generationConfig,
  };

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gemini API request failed (${response.status}).`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson?.error?.message || errorMessage;
      } catch (e) {}
      if (
        response.status === 400 &&
        errorMessage.includes("API key not valid")
      ) {
        errorMessage =
          "Invalid Gemini API Key. Please check the key in options.";
      } else if (response.status === 429) {
        errorMessage = "Gemini API quota exceeded.";
      }
      return { error: true, message: errorMessage };
    }

    const data = await response.json();

    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      const generatedJsonString = data.candidates[0].content.parts[0].text;
      try {
        const parsedResult = JSON.parse(generatedJsonString);
        if (parsedResult.error) {
          return { error: true, message: parsedResult.error };
        }
        if (
          !parsedResult.word ||
          !parsedResult.phonetic ||
          !parsedResult.partOfSpeech ||
          !parsedResult.definition_en ||
          !parsedResult.translation_vi ||
          !parsedResult.example_en
        ) {
          throw new Error(
            "Invalid JSON structure received from Gemini (single meaning)."
          );
        }
        return { ...parsedResult, error: false };
      } catch (parseError) {
        console.error(
          "Failed to parse JSON (single meaning):",
          parseError,
          "\nReceived text:",
          generatedJsonString
        );
        return { error: true, message: "Failed to parse response from AI." };
      }
    } else {
      let blockReason = data.candidates?.[0]?.finishReason || "Unknown";
      if (blockReason === "SAFETY") {
        return {
          error: true,
          message: `Content blocked by AI safety filters.`,
        };
      }
      return {
        error: true,
        message: `Invalid or empty response structure from AI.`,
      };
    }
  } catch (error) {
    console.error("Network error calling Gemini API:", error);
    return { error: true, message: "Network error contacting AI service." };
  }
}

async function addWordToStorage(wordData) {
  try {
    const result = await chrome.storage.local.get(["savedWords"]);
    let words = result.savedWords || [];
    const exists = words.find(
      (w) => w.word.toLowerCase() === wordData.word.toLowerCase()
    );
    if (exists) {
      return { success: false, message: "Word already exists." };
    }
    wordData.timestamp = Date.now();
    words.push(wordData);
    await chrome.storage.local.set({ savedWords: words });
    return { success: true, message: "Word added successfully." };
  } catch (error) {
    console.error("addWordToStorage error:", error);
    return { success: false, message: "Failed to save word." };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getDetailsAndShowPopup") {
    (async () => {
      const geminiResult = await getWordInfoFromGemini(request.text);
      if (geminiResult.error) {
        sendResponse({ success: false, message: geminiResult.message });
        return;
      }
      const { error, ...wordDataToShow } = geminiResult;
      try {
        await chrome.storage.session.set({ wordToShowInPopup: wordDataToShow });
        await chrome.action.openPopup();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          message: "Failed to prepare or open popup.",
        });
      }
    })();
    return true;
  }

  if (request.action === "addWord") {
    (async () => {
      const geminiResult = await getWordInfoFromGemini(request.text);
      if (geminiResult.error) {
        sendResponse({ success: false, message: geminiResult.message });
        return;
      }
      const { error, ...wordDataToStore } = geminiResult;
      const storageResult = await addWordToStorage(wordDataToStore);
      sendResponse(storageResult);
    })();
    return true;
  }

  console.warn("Unhandled action:", request.action);
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["savedWords"], (result) => {
    if (!Array.isArray(result.savedWords)) {
      chrome.storage.local.set({ savedWords: [] });
    }
  });
});

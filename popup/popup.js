document.addEventListener("DOMContentLoaded", async () => {
  const currentWordDisplay = document.getElementById("current-word-display");
  const currentWordDetailsDiv = document.getElementById("current-word-details");
  const wordListDiv = document.getElementById("word-list");
  const todayHeader = document.querySelector("h1");

  wordListDiv.innerHTML = "<p>Loading...</p>";

  try {
    const sessionResult = await chrome.storage.session.get([
      "wordToShowInPopup",
    ]);

    if (chrome.runtime.lastError) {
      console.error("Error reading session:", chrome.runtime.lastError);
    } else if (sessionResult && sessionResult.wordToShowInPopup) {
      const wordData = sessionResult.wordToShowInPopup;
      currentWordDetailsDiv.innerHTML = "";
      const entryDiv = createWordEntryElement(wordData, false);
      currentWordDetailsDiv.appendChild(entryDiv);
      currentWordDisplay.style.display = "block";
      await chrome.storage.session.remove("wordToShowInPopup");
      todayHeader.style.display = "none";
      wordListDiv.style.display = "none";
      return;
    }
  } catch (error) {
    console.error("Error accessing session:", error);
  }

  todayHeader.style.display = "block";
  wordListDiv.style.display = "block";
  currentWordDisplay.style.display = "none";

  try {
    const localResult = await chrome.storage.local.get(["savedWords"]);

    if (chrome.runtime.lastError) {
      wordListDiv.innerHTML = '<p class="no-words">Error loading words.</p>';
      return;
    }

    const allWords = localResult.savedWords || [];
    const todayWords = filterWordsForToday(allWords);
    wordListDiv.innerHTML = "";

    if (todayWords.length === 0) {
      wordListDiv.innerHTML = '<p class="no-words">No words saved today</p>';
    } else {
      todayWords.forEach((wordData) => {
        const entryDiv = createWordEntryElement(wordData, true);
        wordListDiv.appendChild(entryDiv);
      });
    }
  } catch (error) {
    wordListDiv.innerHTML =
      '<p class="no-words">Error loading saved words.</p>';
  }
});

function filterWordsForToday(savedWords) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return savedWords.filter((wordData) => {
    if (!wordData.timestamp) return false;
    const wordDate = new Date(wordData.timestamp);
    wordDate.setHours(0, 0, 0, 0);
    return wordDate.getTime() === today.getTime();
  });
}

function createWordEntryElement(wordData, includeTimestamp = false) {
  const mainDiv = document.createElement("div");
  mainDiv.className = "word-entry";

  const header = document.createElement("p");
  header.className = "word-header";
  const wordSpan = document.createElement("span");
  wordSpan.textContent = wordData.word;
  wordSpan.style.fontWeight = "bold";
  header.appendChild(wordSpan);
  if (wordData.phonetic && wordData.phonetic !== "N/A") {
    const phoneticSpan = document.createElement("span");
    phoneticSpan.className = "phonetic";
    phoneticSpan.textContent = ` /${wordData.phonetic}/`;
    phoneticSpan.style.fontStyle = "italic";
    phoneticSpan.style.color = "#555";
    header.appendChild(phoneticSpan);
  }
  mainDiv.appendChild(header);

  if (wordData.partOfSpeech && wordData.partOfSpeech !== "N/A") {
    const pos = document.createElement("p");
    pos.className = "part-of-speech";
    pos.textContent = `(${wordData.partOfSpeech})`;
    pos.style.fontSize = "0.9em";
    pos.style.fontStyle = "italic";
    pos.style.color = "#777";
    pos.style.marginBottom = "2px";
    mainDiv.appendChild(pos);
  }

  const meaningEn = document.createElement("p");
  meaningEn.className = "meaning-en";
  meaningEn.style.margin = "4px 0";
  meaningEn.innerHTML = `<b>Eng:</b> ${wordData.definition_en || "N/A"}`;
  mainDiv.appendChild(meaningEn);

  if (wordData.translation_vi) {
    const meaningVi = document.createElement("p");
    meaningVi.className = "meaning-vi";
    meaningVi.style.margin = "4px 0";
    if (wordData.translation_vi.startsWith("[")) {
      meaningVi.innerHTML = `<b>Vie:</b> <i style="color: red;">${wordData.translation_vi}</i>`;
    } else {
      meaningVi.innerHTML = `<b>Vie:</b> ${wordData.translation_vi}`;
    }
    mainDiv.appendChild(meaningVi);
  }

  if (wordData.example_en && wordData.example_en !== "N/A") {
    const example = document.createElement("p");
    example.className = "example";
    example.style.margin = "4px 0";
    example.style.fontStyle = "italic";
    example.style.color = "#666";
    example.innerHTML = `Ex: ${wordData.example_en}`;
    mainDiv.appendChild(example);
  }

  if (includeTimestamp && wordData.timestamp) {
    const timestampP = document.createElement("p");
    timestampP.style.fontSize = "0.8em";
    timestampP.style.color = "#999";
    timestampP.style.marginTop = "10px";
    timestampP.style.borderTop = "1px solid #eee";
    timestampP.style.paddingTop = "5px";
    timestampP.textContent = `Saved: ${new Date(
      wordData.timestamp
    ).toLocaleString()}`;
    mainDiv.appendChild(timestampP);
  }
  return mainDiv;
}

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const googleLoginButton = document.getElementById('google-login');
const signOutButton = document.getElementById('sign-out');
const userDisplay = document.getElementById('user-display');
const searchButton = document.getElementById('search-button');
const wordInput = document.getElementById('word-input');
const resultCard = document.getElementById('result-card');
const resultWord = document.getElementById('result-word');
const resultPhonetic = document.getElementById('result-phonetic');
const resultRoot = document.getElementById('result-root');
const resultDefinition = document.getElementById('result-definition');
const resultExample = document.getElementById('result-example');

// ==========================================
// 1. Firebase 核心初始化設定 
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBbQbjdNJZEhmSzcHSK7XKYlPeYj9jT2qk", // 這裡保持妳原本那串正確的金鑰
    authDomain: "examguardian-72fe2.firebaseapp.com",
    projectId: "examguardian-72fe2",
    storageBucket: "examguardian-72fe2.appspot.com",
    messagingSenderId: "565039014631",
    appId: "1:565039014631:web:d8dfb3b28b7e283286f903",
    databaseURL: "https://examguardian-72fe2-default-rtdb.firebaseio.com/" // 👈 檢查這行有沒有在引號裡！
};

// 初始化 Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 資料庫宣告
const database = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
// ⚡ 這裡就是第一步要補的地方！把資料夾按鈕的電線接上
const createFolderBtn = document.getElementById('create-folder-btn');
const folderInput = document.getElementById('new-folder-input');


// ==========================================
// 頂端設定結束，下方保留妳原本的程式碼
// ==========================================


auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log("跳轉登入成功，已取得使用者資訊：", result.user);
    }
}).catch((error) => {
    console.error("跳轉驗證失敗原因：", error);
});
function showSection(section) {
  if (section === 'login') {
    loginSection.classList.remove('hidden');
    appSection.classList.add('hidden');
  } else {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
  }
}

function updateUserDisplay(user) {
  const displayName = user.displayName || user.email || '讀者';
  userDisplay.textContent = displayName;
}

auth.onAuthStateChanged((user) => {
  if (user) {
    updateUserDisplay(user);
    showSection('app');
  } else {
    showSection('login');
    clearResult();
  }
});

// ==================== 🔐 終極回歸：最穩定彈出視窗登入 ====================
if (googleLoginButton) {
    googleLoginButton.addEventListener('click', async () => {
        try {
            console.log("正在發動 Google 登入彈出視窗...");
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
            console.log("Google 登入成功！");
        } catch (error) {
            console.error('Google 登入失敗原因：', error);
            alert('登入時發生錯誤，請重新整理網頁再試。');
        }
    });
}


signOutButton.addEventListener('click', async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('登出失敗：', error);
    alert('登出時發生錯誤，請稍後再試。');
  }
});

searchButton.addEventListener('click', () => {
  const word = wordInput.value.trim();
  if (!word) {
    alert('請輸入要查詢的單字。');
    return;
  }
  fetchWordData(word.toLowerCase());
});

wordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    searchButton.click();
  }
});

function fetchWordData(word) {
  const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error('查無此單字');
      }
      return response.json();
    })
    .then((data) => {
      const entry = Array.isArray(data) ? data[0] : data;
      const phonetics = entry.phonetics || [];
      const meanings = entry.meanings || [];
      const firstMeaning = meanings[0] || {};
      const definitions = firstMeaning.definitions || [];

      renderResultCard({
        word: entry.word || word,
        phonetic: phonetics.find((item) => item.text)?.text || '/ˈdɛfɔlt/',
        roots: mockRootDecomposition(entry.word || word),
        definitions: definitions.map((item) => item.definition).filter(Boolean),
        examples: definitions.map((item) => item.example).filter(Boolean),
      });

      const currentUser = auth.currentUser;
      if (currentUser) {
        saveToGoogleSheets(
          entry.word || word,
          definitions[0]?.definition || '',
          definitions[0]?.example || ''
        );
      }
    })
    .catch((error) => {
      console.error('查詢失敗：', error);
      alert('查詢失敗，請確認單字是否正確或稍後再試。');
      clearResult();
    });
}

function renderResultCard({ word, phonetic, roots, definitions, examples }) {
  resultWord.textContent = word;
  resultPhonetic.textContent = phonetic;
  resultRoot.textContent = roots;

  resultDefinition.innerHTML = '';
  if (definitions.length > 0) {
    definitions.forEach((def) => {
      const li = document.createElement('li');
      li.textContent = def;
      resultDefinition.appendChild(li);
    });
  } else {
    resultDefinition.innerHTML = '<li>目前無可顯示的定義。</li>';
  }

  resultExample.innerHTML = '';
  if (examples.length > 0) {
    examples.forEach((example) => {
      const li = document.createElement('li');
      li.textContent = example;
      resultExample.appendChild(li);
    });
  } else {
    resultExample.innerHTML = '<li>目前無可顯示的例句。</li>';
  }

  resultCard.classList.remove('hidden');
}

function clearResult() {
  resultCard.classList.add('hidden');
  resultWord.textContent = '單字';
  resultPhonetic.textContent = '/音標/';
  resultRoot.textContent = 'com- + mit';
  resultDefinition.innerHTML = '';
  resultExample.innerHTML = '';
}

function mockRootDecomposition(word) {
  const lowerWord = word.toLowerCase();
  const commonRoots = {
    commit: 'com- + mit',
    transport: 'trans- + port',
    interact: 'inter- + act',
    inspire: 'in- + spire',
    progress: 'pro- + gress',
  };

  if (commonRoots[lowerWord]) {
    return commonRoots[lowerWord];
  }

  const midpoint = Math.floor(lowerWord.length / 2);
  return `${lowerWord.slice(0, midpoint)}- + ${lowerWord.slice(midpoint)}`;
}

function saveToGoogleSheets(word, def, ex) {
    const user = firebase.auth().currentUser;
    if (!user) {
        console.log("未登入，不儲存單字");
        return; 
    }

    // ✨ 脫胎換骨！直接把單字存進 Firebase
    database.ref('users/' + user.uid + '/all_words').push({
        word: word,
        definition: def,
        example: ex,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        console.log("單字已成功同步至 Firebase！");
    }).catch((error) => {
        console.error("Firebase 儲存單字失敗：", error);
    });
}
// ==================== 📂 方案 B：自訂資料夾與片語書架全新核心邏輯 ====================

let currentReviewList = [];
let currentCardIndex = 0;
let userFoldersList = ["📥 未分類查詢紀錄"]; // 內建系統預設資料夾

// 1. 監聽原本查詢按鈕的額外動作：讓儲存資料夾區塊與查詢結果同步出現
document.getElementById('search-button').addEventListener('click', () => {
    const word = document.getElementById('word-input').value.trim();
    if (word) {
        // 給 API 一點反應時間，隨後顯示儲存選單
        setTimeout(() => {
            const resultCard = document.getElementById('result-card');
            if (resultCard && !resultCard.classList.contains('hidden')) {
                document.getElementById('result-word-b').innerText = `想要儲存「${word}」嗎？`;
                document.getElementById('search-result-container').style.display = 'block';
            }
        }, 1200);
    }
});

// 2. 建立新資料夾功能
document.getElementById('create-folder-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return alert('請先登入 Google 帳號！');

    const folderName = document.getElementById('new-folder-input').value.trim();
    if (!folderName) return alert('請輸入資料夾名稱！');
    if (folderName === "📥 未分類查詢紀錄") return alert('不能建立與系統預設相同的資料夾名稱！');

    // 寫入 Firebase 使用者的資料夾清單
    database.ref(`users/${user.uid}/customFolders/${folderName}`).set(true)
    .then(() => {
        alert(`成功建立資料夾：【${folderName}】！`);
        document.getElementById('new-folder-input').value = '';
        loadBookshelf(); // 重新整理書架
    });
});

// 3. 確認儲存單字功能
document.getElementById('save-vocab-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return alert('請先登入 Google 帳號！');
    
    const word = document.getElementById('word-input').value.trim().toLowerCase();
    if (!word) return alert('找不到正在查詢的單字！');

    let selectedFolder = document.getElementById('folder-select').value;
    if (!selectedFolder) selectedFolder = "📥 未分類查詢紀錄";

    // 撈取畫面上現有的定義與例句當作小卡內容
    const defElement = document.getElementById('result-definition');
    const exElement = document.getElementById('result-example');
    const definitionText = defElement ? defElement.innerText : "暫無定義";
    const exampleText = exElement ? exElement.innerText : "暫無例句";

    database.ref(`users/${user.uid}/folders/${selectedFolder}/${word}`).set({
        translation: definitionText.split('\n')[0] || "已儲存", // 抓取第一條定義當主翻譯
        usage: "自訂資料夾收藏",
        example: exampleText.split('\n')[0] || "暫無實用例句",
        savedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert(`成功將 [${word}] 存入【${selectedFolder}】！`);
        loadBookshelf();
    });
});

// 4. 載入與即時同步書架
function loadBookshelf() {
    const user = auth.currentUser;
    if (!user) return;

    userFoldersList = ["📥 未分類查詢紀錄"];

    // 抓取自訂資料夾
    database.ref(`users/${user.uid}/customFolders`).once('value', (customSnapshot) => {
        if (customSnapshot.exists()) {
            Object.keys(customSnapshot.val()).forEach(f => userFoldersList.push(f));
        }

        updateDropdownOptions();

        // 統計各資料夾字數並繪製書架
        database.ref(`users/${user.uid}/folders`).once('value', (vocabSnapshot) => {
            const vocabData = vocabSnapshot.val() || {};
            const bookshelf = document.getElementById('bookshelf');
            bookshelf.innerHTML = '';

            userFoldersList.forEach(folderName => {
                const count = vocabData[folderName] ? Object.keys(vocabData[folderName]).length : 0;
                
                const folderBtn = document.createElement('button');
                folderBtn.innerHTML = `📔 <strong>${folderName}</strong><br><small style="opacity:0.7;">已存: ${count} 字</small>`;
                folderBtn.style.cssText = "padding: 15px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 10px; cursor: pointer; text-align: left; min-width: 140px; transition: 0.3s;";
                
                folderBtn.onmouseover = () => folderBtn.style.background = "rgba(255,255,255,0.3)";
                folderBtn.onmouseout = () => folderBtn.style.background = "rgba(255,255,255,0.15)";

                folderBtn.addEventListener('click', () => {
                    if (count === 0) return alert(`【${folderName}】目前裡面沒有單字喔！`);
                    startReviewSession(folderName, vocabData[folderName]);
                });

                bookshelf.appendChild(folderBtn);
            });
        });
    });
}

// 刷新所有下拉選單
function updateDropdownOptions() {
    const folderSelect = document.getElementById('folder-select');
    const moveFolderSelect = document.getElementById('move-folder-select');
    
    if(!folderSelect || !moveFolderSelect) return;
    folderSelect.innerHTML = '';
    moveFolderSelect.innerHTML = '';

    userFoldersList.forEach(folder => {
        const opt1 = document.createElement('option');
        opt1.value = folder; opt1.innerText = folder;
        folderSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = folder; opt2.innerText = folder;
        moveFolderSelect.appendChild(opt2);
    });
}

// 5. 字卡快刷複習模式
function startReviewSession(folderName, wordsData) {
    currentReviewList = Object.keys(wordsData).map(word => {
        return { 
            word: word, 
            translation: wordsData[word].translation,
            usage: wordsData[word].usage,
            example: wordsData[word].example,
            currentFolder: folderName
        };
    });
    currentCardIndex = 0;

    document.getElementById('current-folder-title').innerText = `🔄 正在複習：${folderName}`;
    document.getElementById('review-card-container').style.display = 'block';
    renderCard();
}

// 🔄 優化後的渲染字卡內容功能（支援一字多義與防閃對齊）
function renderCard() {
    const currentItem = currentReviewList[currentCardIndex];
    if (!currentItem) return;

    // 1. 單字主體
    document.getElementById('card-word').innerText = currentItem.word;
    
    // 2. 🧠 聰明解析一字多義
    const translationElement = document.getElementById('card-translation');
    if (translationElement) {
        // 如果翻譯裡包含英文字、分號或本來就是陣列，我們來把它漂亮排版
        if (typeof currentItem.translation === 'string' && currentItem.translation.includes(';')) {
            const meanings = currentItem.translation.split(';');
            translationElement.innerHTML = meanings.map((m, idx) => `<br>${idx + 1}. ${m.trim()}`).join('');
        } else if (typeof currentItem.translation === 'string' && currentItem.translation.includes('；')) {
            const meanings = currentItem.translation.split('；');
            translationElement.innerHTML = meanings.map((m, idx) => `<br>${idx + 1}. ${m.trim()}`).join('');
        } else {
            // 如果只有一個意思，就正常顯示
            translationElement.innerText = currentItem.translation || "暫無翻譯";
        }
    }

    // 3. 用法說明
    document.getElementById('card-usage').innerText = currentItem.usage || "自訂資料夾收藏";
    
    // 4. 例句防呆（如果沒有例句，給個好看的小燈泡提示）
    const exampleElement = document.getElementById('card-example');
    if (exampleElement) {
        if (currentItem.example && currentItem.example !== "詞條目前無可顯示的例句。" && currentItem.example !== "目前無可顯示的例句。") {
            exampleElement.innerText = currentItem.example;
        } else {
            exampleElement.innerText = "💡 這個單字目前還沒有添加實用例句喔！";
        }
    }

    // 5. 預設先隱藏背面
    document.getElementById('card-back').style.display = 'none';
}

// 點擊卡片翻面
document.getElementById('vocab-card').addEventListener('click', () => {
    const back = document.getElementById('card-back');
    back.style.display = back.style.display === 'none' ? 'block' : 'none';
});

// 切換字卡
document.getElementById('next-card').addEventListener('click', (e) => {
    e.stopPropagation(); // 防止觸發翻面
    if (currentCardIndex < currentReviewList.length - 1) {
        currentCardIndex++; renderCard();
    } else {
        alert('太棒了！這個資料夾的字卡都複習完囉！🎉');
    }
});
document.getElementById('prev-card').addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentCardIndex > 0) {
        currentCardIndex--; renderCard();
    }
});

// 6. 單字重新分類（搬家功能）
document.getElementById('move-vocab-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user || currentReviewList.length === 0) return;

    const currentItem = currentReviewList[currentCardIndex];
    const targetFolder = document.getElementById('move-folder-select').value;

    if (currentItem.currentFolder === targetFolder) return alert('單字已經在這個資料夾裡囉！');

    database.ref(`users/${user.uid}/folders/${targetFolder}/${currentItem.word}`).set({
        translation: currentItem.translation,
        usage: currentItem.usage,
        example: currentItem.example,
        savedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        return database.ref(`users/${user.uid}/folders/${currentItem.currentFolder}/${currentItem.word}`).remove();
    }).then(() => {
        alert(`成功將 [${currentItem.word}] 移至【${targetFolder}】！`);
        document.getElementById('review-card-container').style.display = 'none';
        loadBookshelf();
    });
});

// 7. 升級版的安全登入狀態監聽（融合原本的畫面切換與新書架載入）
auth.onAuthStateChanged((user) => {
    if (user) {
        updateUserDisplay(user);
        showSection('app');
    loadBookshelf(); // 登入成功，載入精裝書架
    // 啟動即時同步資料夾與書架監聽器
    if (typeof startListeningToFolders === 'function') startListeningToFolders(user);
    } else {
        showSection('login');
        if (typeof clearResult === "function") clearResult();
        const bookshelf = document.getElementById('bookshelf');
        if(bookshelf) bookshelf.innerHTML = '請先登入以檢視個人精裝書架。';
        document.getElementById('review-card-container').style.display = 'none';
        document.getElementById('search-result-container').style.display = 'none';
    }
});

// ==========================================
// 🛠️ 建立資料夾功能（終極無懈可擊版 - 解決網頁載入時間差）
// ==========================================
function setupFolderCreation() {
    const btn = document.getElementById('create-folder-btn');
    const input = document.getElementById('new-folder-input');
    
    console.log("【終極診斷】按鈕元件狀態：", btn);
    console.log("【終極診斷】輸入框元件狀態：", input);

    if (btn && input) {
        btn.onclick = function() {
            console.log("💥 偵測到建立資料夾按鈕被點擊！");
            const folderName = input.value.trim();
            const user = firebase.auth().currentUser;
            
            console.log("目前登入的用戶：", user ? user.displayName : "未登入");

            if (!user) { alert("請先登入喔！"); return; }
            if (!folderName) { alert("請輸入資料夾名稱！"); return; }

            // 寫入 Firebase 資料庫
            database.ref('users/' + user.uid + '/folders').push({
                name: folderName,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                alert("🎉 資料夾建立成功！");
                input.value = ''; // 清空輸入框
                if (typeof loadFolders === 'function') loadFolders();
            }).catch((error) => {
                console.error("❌ Firebase 儲存失敗原因：", error);
            });
        };
        console.log("✅ 建立資料夾按鈕電線對接成功！功能已就緒。");
    } else {
        console.error("❌ 錯誤：找不到按鈕或輸入框，請確認 HTML 帶有對應的 ID！");
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFolderCreation);
} else {
    setupFolderCreation();
}

// ==========================================
// 🔄 全自動即時同步資料夾、選單與書架功能
// ==========================================
function startListeningToFolders(user) {
  if (!user) return;

  const folderSelect = document.getElementById('folder-select');
  const moveFolderSelect = document.getElementById('move-folder-select');
  const bookshelf = document.getElementById('bookshelf');

  console.log("📡 開始即時監聽 Firebase 資料夾變動...");

  const refPath = 'users/' + user.uid + '/folders';
  // 先解除舊的監聽器，避免重複觸發
  database.ref(refPath).off();

  // 監聽該登入用戶路徑下的 folders 資料變動 (.on 代表即時同步)
  database.ref(refPath).on('value', (snapshot) => {
    // 1. 先清空舊的選單與書架內容，避免重複疊加
    if (folderSelect) folderSelect.innerHTML = '<option value="">-- 請選擇資料夾 --</option>';
    if (moveFolderSelect) moveFolderSelect.innerHTML = '<option value="">-- 請選擇資料夾 --</option>';
    if (bookshelf) bookshelf.innerHTML = '';

    const folders = snapshot.val();

    // 如果資料庫是空的、還沒有任何資料夾
    if (!folders) {
      if (bookshelf) bookshelf.innerHTML = '<p style="color: #bbb; padding: 10px;">目前書架空空如也，快在上方建立一個吧！</p>';
      return;
    }

    // 2. 開始把資料庫裡的資料夾，一個一個畫到網頁上
    Object.keys(folders).forEach((folderId) => {
      const folder = folders[folderId];

      // (A) 加進「儲存至資料夾」下拉選單
      if (folderSelect) {
        const opt = document.createElement('option');
        opt.value = folderId;
        opt.textContent = folder.name;
        folderSelect.appendChild(opt);
      }

      // (B) 加進「搬家」下拉選單
      if (moveFolderSelect) {
        const opt = document.createElement('option');
        opt.value = folderId;
        opt.textContent = folder.name;
        moveFolderSelect.appendChild(opt);
      }

      // (C) 漂亮的精裝書架小盒子
      if (bookshelf) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-book';
        folderDiv.style.cssText = "background: linear-gradient(135deg, #E040FB, #00E5FF); color: white; padding: 15px 25px; border-radius: 10px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.3); text-align: center; min-width: 110px; transition: transform 0.2s;";
        folderDiv.textContent = '📘 ' + folder.name;

        // 點擊書架上的資料夾（未來可以擴充讀取該資料夾單字的功能）
        folderDiv.onclick = () => {
          alert("📂 妳點擊了資料夾： " + folder.name);
        };
        bookshelf.appendChild(folderDiv);
      }
    });
    console.log("✨ 網頁選單與書架已同步更新完畢！");
  });
}

// 登出時解除所有 users 下的監聽，避免殘留
auth.onAuthStateChanged((u) => {
  if (!u) {
    try { database.ref('users').off(); } catch (e) { /* ignore */ }
  }
});

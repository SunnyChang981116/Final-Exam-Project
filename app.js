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

// =================================================================
// 🎯 詠晴專屬專案：字卡渲染、一字多義、IG風格側邊欄與行事曆終極核心
// (從第 340 行起全面安全對接版，絕不重複宣告、絕不黑屏)
// =================================================================

// 🔄 1. 字卡渲染核心（完美對接妳的 vocabList 變數）
function renderCard() {
    // 防呆：確保單字清單存在且有資料
    if (typeof vocabList === 'undefined' || !vocabList || vocabList.length === 0) {
        console.log("💡 目前書架資料夾內尚無單字可供複習。");
        return;
    }
    
    // 確保索引值安全
    if (typeof currentCardIndex === 'undefined') currentCardIndex = 0;
    
    const currentItem = vocabList[currentCardIndex];
    if (!currentItem) return;

    // A. 呈現單字
    const wordEl = document.getElementById('card-word');
    if (wordEl) wordEl.innerText = currentItem.word || "Unknown";
    
    // B. 🧠 聰明解析一字多義與英文定義錯置
    const translationEl = document.getElementById('card-translation');
    if (translationEl) {
        const transText = currentItem.translation || "";
        // 判斷是否被抓成了長串英文定義
        const isEnglishJson = /[a-zA-Z]{5,}/.test(transText) && !/[\u4e00-\u9fa5]/.test(transText);
        
        if (isEnglishJson) {
            translationEl.innerHTML = `<span style="color: #ff5555; font-size:14px;">⚠️ 欄位誤植英文定義</span><br><small style="color: #bbb; font-size: 12px; line-height: 1.2;">${transText}</small>`;
        } else if (transText.includes(';') || transText.includes('；')) {
            // 自動偵測中英文分號，拆開變成漂亮的 1. 2. 3. 清單
            const delimiter = transText.includes(';') ? ';' : '；';
            const meanings = transText.split(delimiter);
            translationEl.innerHTML = meanings.map((m, idx) => `<div style="margin-top:4px;">${idx + 1}. ${m.trim()}</div>`).join('');
        } else {
            translationEl.innerText = transText || "暫無翻譯";
        }
    }

    // C. 呈現用法說明
    const usageEl = document.getElementById('card-usage');
    if (usageEl) usageEl.innerText = currentItem.usage || "自訂資料夾收藏";
    
    // D. 呈現例句防呆
    const exampleEl = document.getElementById('card-example');
    if (exampleEl) {
        if (currentItem.example && !currentItem.example.includes("目前無可顯示")) {
            exampleEl.innerText = currentItem.example;
        } else {
            exampleEl.innerText = "💡 這個單字目前還沒有添加實用例句喔！";
        }
    }

    // E. 預設隱藏卡片背面
    const backEl = document.getElementById('card-back');
    if (backEl) backEl.style.display = 'none';
}

// 📱 2. 側邊欄控制（直接綁定，不使用 const 宣告，百分之百避免重複宣告衝突！）
if (document.getElementById('menu-toggle-btn') && document.getElementById('side-drawer')) {
    document.getElementById('menu-toggle-btn').onclick = () => { 
        document.getElementById('side-drawer').style.left = '0px'; 
    };
}
if (document.getElementById('close-drawer-btn') && document.getElementById('side-drawer')) {
    document.getElementById('close-drawer-btn').onclick = () => { 
        document.getElementById('side-drawer').style.left = '-450px'; 
    };
}

// 側邊欄內部頁籤切換 (單字書架 vs 複習月曆)
if (document.getElementById('tab-vocab-btn') && document.getElementById('tab-calendar-btn')) {
    document.getElementById('tab-vocab-btn').onclick = () => {
        document.getElementById('tab-vocab-btn').style.background = '#E040FB';
        document.getElementById('tab-vocab-btn').style.color = '#fff';
        document.getElementById('tab-calendar-btn').style.background = 'rgba(255,255,255,0.1)';
        document.getElementById('tab-calendar-btn').style.color = '#fff';
        if(document.getElementById('drawer-vocab-content')) document.getElementById('drawer-vocab-content').style.display = 'block';
        if(document.getElementById('drawer-calendar-content')) document.getElementById('drawer-calendar-content').style.display = 'none';
    };

    document.getElementById('tab-calendar-btn').onclick = () => {
        document.getElementById('tab-calendar-btn').style.background = '#00E5FF';
        document.getElementById('tab-calendar-btn').style.color = '#111';
        document.getElementById('tab-vocab-btn').style.background = 'rgba(255,255,255,0.1)';
        document.getElementById('tab-vocab-btn').style.color = '#fff';
        if(document.getElementById('drawer-vocab-content')) document.getElementById('drawer-vocab-content').style.display = 'none';
        if(document.getElementById('drawer-calendar-content')) document.getElementById('drawer-calendar-content').style.display = 'block';
        initCalendarModule(); // 動態畫月曆
    };
}

// 📅 3. 動態行事曆月曆渲染大腦
let calCurrentDate = new Date();
let calSelectedDateStr = "";

function initCalendarModule() {
    const monthTitle = document.getElementById('calendar-month-title');
    const daysGrid = document.getElementById('calendar-days-grid');
    if (!daysGrid || !monthTitle) return;

    daysGrid.innerHTML = '';
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    monthTitle.textContent = `${year}年 ${month + 1}月`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        daysGrid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.textContent = day;
        dayCell.style.cssText = "padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px; cursor: pointer; font-size: 13px; text-align: center; transition: all 0.2s;";
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        dayCell.onclick = () => {
            Array.from(daysGrid.children).forEach(c => { if(c.style) c.style.border = "none"; });
            dayCell.style.border = "2px solid #00E5FF";
            calSelectedDateStr = dateStr;
            if (document.getElementById('selected-date-title')) {
                document.getElementById('selected-date-title').textContent = `📅 日期：${dateStr}`;
            }
            loadCalendarEventsModule(dateStr);
        };
        daysGrid.appendChild(dayCell);
    }
}

// 月份切換按鈕
if (document.getElementById('prev-month-btn')) { 
    document.getElementById('prev-month-btn').onclick = () => { calCurrentDate.setMonth(calCurrentDate.getMonth() - 1); initCalendarModule(); }; 
}
if (document.getElementById('next-month-btn')) { 
    document.getElementById('next-month-btn').onclick = () => { calCurrentDate.setMonth(calCurrentDate.getMonth() + 1); initCalendarModule(); }; 
}

// 📡 4. 行事曆 Firebase 資料庫連線模組
if (document.getElementById('add-event-btn')) {
    document.getElementById('add-event-btn').onclick = () => {
        const text = document.getElementById('event-input') ? document.getElementById('event-input').value.trim() : '';
        const user = firebase.auth().currentUser;
        if (!user || !calSelectedDateStr || !text) return;

        const activeDb = (typeof database !== 'undefined') ? database : ((typeof db !== 'undefined') ? db : null);
        if (!activeDb) return;

        activeDb.ref(`users/${user.uid}/calendar/${calSelectedDateStr}`).push({
            task: text,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            if (document.getElementById('event-input')) document.getElementById('event-input').value = '';
            loadCalendarEventsModule(calSelectedDateStr);
        });
    };
}

function loadCalendarEventsModule(dateStr) {
    const user = firebase.auth().currentUser;
    if (!user || !document.getElementById('event-list')) return;
    const activeDb = (typeof database !== 'undefined') ? database : ((typeof db !== 'undefined') ? db : null);
    if (!activeDb) return;

    activeDb.ref(`users/${user.uid}/calendar/${dateStr}`).on('value', (snapshot) => {
        const listEvent = document.getElementById('event-list');
        listEvent.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            listEvent.innerHTML = '<li style="color:#aaa; list-style:none; font-size:13px; padding: 4px;">當天還沒有排入複習任務。</li>';
            return;
        }
        Object.keys(data).forEach(key => {
            const li = document.createElement('li');
            li.style.cssText = "margin-bottom: 6px; font-size:13px; list-style: none; color: #fff; padding-left: 4px;";
            li.textContent = `🔹 ${data[key].task}`;
            listEvent.appendChild(li);
        });
    });
}

// 🔐 5. 登入狀態守衛：控制主按鈕顯示
if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            if (document.getElementById('menu-toggle-btn')) document.getElementById('menu-toggle-btn').style.display = 'block';
        } else {
            if (document.getElementById('menu-toggle-btn')) document.getElementById('menu-toggle-btn').style.display = 'none';
            if (document.getElementById('side-drawer')) document.getElementById('side-drawer').style.left = '-450px';
        }
    });
}
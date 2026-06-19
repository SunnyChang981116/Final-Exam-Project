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
    apiKey: "AIzaSyBbQbjdNJZEhmSzcHSK7XKYlPeYj9jT2qk", 
    authDomain: "examguardian-72fe2.firebaseapp.com",
    projectId: "examguardian-72fe2",
    storageBucket: "examguardian-72fe2.appspot.com",
    messagingSenderId: "565039014631",
    appId: "1:565039014631:web:d8dfb3b28b7e283286f903",
    databaseURL: "https://examguardian-72fe2-default-rtdb.firebaseio.com/" 
};

// 初始化 Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 資料庫宣告
const database = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const createFolderBtn = document.getElementById('create-folder-btn');
const folderInput = document.getElementById('new-folder-input');

// ==========================================
// 2. 基礎流程控制與登入狀態監聽
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

// 監聽登入狀態切換
auth.onAuthStateChanged((user) => {
  if (user) {
    updateUserDisplay(user);
    showSection('app');
    loadBookshelf();         // 登入成功後，載入專屬書架資料
    initCalendarModule();   // 🛠️ 核心修正：主畫面是行事曆，登入成功就立刻畫出月曆！
  } else {
    showSection('login');
    clearResult();
  }
});

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

// ==========================================
// 3. 單字 API 查詢功能
// ==========================================
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
    if (!user) return; 

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

// ==========================================
// 4. 自訂書架與字卡核心邏輯
// ==========================================

let currentReviewList = []; // 複習單字陣列
let currentCardIndex = 0;   // 目前翻到第幾張
let userFoldersList = ["📥 未分類查詢紀錄"]; 

// 點擊查詢按鈕同步跳出資料夾儲存詢問區
searchButton.addEventListener('click', () => {
    const word = wordInput.value.trim();
    if (word) {
        setTimeout(() => {
            if (resultCard && !resultCard.classList.contains('hidden')) {
                document.getElementById('result-word-b').innerText = `想要儲存「${word}」嗎？`;
                document.getElementById('search-result-container').style.display = 'block';
            }
        }, 1200);
    }
});

// 建立新資料夾
if (createFolderBtn) {
    createFolderBtn.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) return alert('請先登入 Google 帳號！');

        const folderName = folderInput.value.trim();
        if (!folderName) return alert('請輸入資料夾名稱！');
        if (folderName === "📥 未分類查詢紀錄") return alert('不能建立與系統預設相同的資料夾名稱！');

        database.ref(`users/${user.uid}/customFolders/${folderName}`).set(true)
        .then(() => {
            alert(`成功建立資料夾：【${folderName}】！`);
            folderInput.value = '';
            loadBookshelf(); 
        });
    });
}

// 確認儲存單字至資料夾
document.getElementById('save-vocab-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return alert('請先登入 Google 帳號！');
    
    const word = wordInput.value.trim().toLowerCase();
    if (!word) return alert('找不到正在查詢的單字！');

    let selectedFolder = document.getElementById('folder-select').value;
    if (!selectedFolder) selectedFolder = "📥 未分類查詢紀錄";

    const defElement = document.getElementById('result-definition');
    const exElement = document.getElementById('result-example');
    const definitionText = defElement ? defElement.innerText : "暫無定義";
    const exampleText = exElement ? exElement.innerText : "暫無例句";

    database.ref(`users/${user.uid}/folders/${selectedFolder}/${word}`).set({
        translation: definitionText.split('\n')[0] || "已儲存", 
        usage: "自訂資料夾收藏",
        example: exampleText.split('\n')[0] || "暫無實用例句",
        savedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert(`成功將 [${word}] 存入【${selectedFolder}】！`);
        loadBookshelf();
    });
});

// 載入與渲染書架按鈕
function loadBookshelf() {
    const user = auth.currentUser;
    if (!user) return;

    userFoldersList = ["📥 未分類查詢紀錄"];

    database.ref(`users/${user.uid}/customFolders`).once('value', (customSnapshot) => {
        if (customSnapshot.exists()) {
            Object.keys(customSnapshot.val()).forEach(f => userFoldersList.push(f));
        }

        updateDropdownOptions();

        database.ref(`users/${user.uid}/folders`).once('value', (vocabSnapshot) => {
            const vocabData = vocabSnapshot.val() || {};
            const bookshelf = document.getElementById('bookshelf');
            if (!bookshelf) return;
            bookshelf.innerHTML = '';

            userFoldersList.forEach(folderName => {
                const count = vocabData[folderName] ? Object.keys(vocabData[folderName]).length : 0;
                
                const folderBtn = document.createElement('button');
                folderBtn.innerHTML = `📔 <strong>${folderName}</strong><br><small style="opacity:0.7;">已存: ${count} 字</small>`;
                folderBtn.style.cssText = "padding: 15px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 10px; cursor: pointer; text-align: left; min-width: 140px; transition: 0.3s; margin: 5px;";
                
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

// 啟動字卡複習
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

// 🛠️ 核心修正：將原本找錯的 vocabList 變數修正為正確的 currentReviewList
function renderCard() {
    if (!currentReviewList || currentReviewList.length === 0) {
        console.log("💡 目前書架資料夾內尚無單字可供複習。");
        return;
    }
    
    if (typeof currentCardIndex === 'undefined') currentCardIndex = 0;
    
    const currentItem = currentReviewList[currentCardIndex];
    if (!currentItem) return;

    // A. 填入英文單字
    const wordEl = document.getElementById('card-word');
    if (wordEl) wordEl.innerText = currentItem.word || "Unknown";
    
    // B. 解析中文翻譯或拆解分號
    const translationEl = document.getElementById('card-translation');
    if (translationEl) {
        const transText = currentItem.translation || "";
        const isEnglishJson = /[a-zA-Z]{5,}/.test(transText) && !/[\u4e00-\u9fa5]/.test(transText);
        
        if (isEnglishJson) {
            translationEl.innerHTML = `<span style="color: #ff5555; font-size:14px;">⚠️ 欄位誤植英文定義</span><br><small style="color: #bbb; font-size: 12px; line-height: 1.2;">${transText}</small>`;
        } else if (transText.includes(';') || transText.includes('；')) {
            const delimiter = transText.includes(';') ? ';' : '；';
            const meanings = transText.split(delimiter);
            translationEl.innerHTML = meanings.map((m, idx) => `<div style="margin-top:4px;">${idx + 1}. ${m.trim()}</div>`).join('');
        } else {
            translationEl.innerText = transText || "暫無翻譯";
        }
    }

    // C. 填入用法
    const usageEl = document.getElementById('card-usage');
    if (usageEl) usageEl.innerText = currentItem.usage || "自訂資料夾收藏";
    
    // D. 填入例句
    const exampleEl = document.getElementById('card-example');
    if (exampleEl) {
        if (currentItem.example && !currentItem.example.includes("目前無可顯示")) {
            exampleEl.innerText = currentItem.example;
        } else {
            exampleEl.innerText = "💡 這個單字目前還沒有添加實用例句喔！";
        }
    }

    // E. 重設卡片狀態為：蓋起來（隱藏背面）
    const backEl = document.getElementById('card-back');
    if (backEl) backEl.style.display = 'none';
}

// 🛠️ 核心修正：綁定「點擊字卡本體」翻面的功能
const vocabCardBtn = document.getElementById('vocab-card');
if (vocabCardBtn) {
    vocabCardBtn.addEventListener('click', () => {
        const backEl = document.getElementById('card-back');
        if (backEl) {
            if (backEl.style.display === 'none') {
                backEl.style.display = 'block'; // 打開背面
            } else {
                backEl.style.display = 'none';  // 收起背面
            }
        }
    });
}

// 🛠️ 核心修正：接上「上一個／下一個」單字按鈕的控制電線
if (document.getElementById('prev-card')) {
    document.getElementById('prev-card').onclick = () => {
        if (currentReviewList.length === 0) return;
        currentCardIndex--;
        if (currentCardIndex < 0) {
            currentCardIndex = currentReviewList.length - 1; // 循環到最後一張
        }
        renderCard();
    };
}

if (document.getElementById('next-card')) {
    document.getElementById('next-card').onclick = () => {
        if (currentReviewList.length === 0) return;
        currentCardIndex++;
        if (currentCardIndex >= currentReviewList.length) {
            currentCardIndex = 0; // 循環回到第一張
        }
        renderCard();
    };
}

// ==========================================
// 5. 側邊欄抽屜開關控制
// ==========================================
if (document.getElementById('menu-toggle-btn')) {
    document.getElementById('menu-toggle-btn').onclick = () => { 
        document.getElementById('side-drawer').style.left = '0px'; 
    };
}
if (document.getElementById('close-drawer-btn')) {
    document.getElementById('close-drawer-btn').onclick = () => { 
        document.getElementById('side-drawer').style.left = '-500px'; 
    };
}

// ==========================================
// 6. 讀書計畫行事曆核心模組
// ==========================================
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

    // 填塞上個月的空白格子
    for (let i = 0; i < firstDayIndex; i++) {
        daysGrid.appendChild(document.createElement('div'));
    }

    // 渲染日期格子
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.textContent = day;
        dayCell.style.cssText = "padding: 10px; background: rgba(255,255,255,0.06); border-radius: 6px; cursor: pointer; font-size: 14px; text-align: center; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.05);";
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        dayCell.onclick = () => {
            Array.from(daysGrid.children).forEach(c => { if(c.style) c.style.borderColor = "rgba(255,255,255,0.05)"; });
            dayCell.style.borderColor = "#00E5FF";
            calSelectedDateStr = dateStr;
            if (document.getElementById('selected-date-title')) {
                document.getElementById('selected-date-title').textContent = `📅 日期：${dateStr}`;
            }
            loadCalendarEventsModule(dateStr);
        };
        daysGrid.appendChild(dayCell);
    }
}

// 月份上下調整
if (document.getElementById('prev-month-btn')) { 
    document.getElementById('prev-month-btn').onclick = () => { calCurrentDate.setMonth(calCurrentDate.getMonth() - 1); initCalendarModule(); }; 
}
if (document.getElementById('next-month-btn')) { 
    document.getElementById('next-month-btn').onclick = () => { calCurrentDate.setMonth(calCurrentDate.getMonth() + 1); initCalendarModule(); }; 
}

// 新增任務至行事曆
if (document.getElementById('add-event-btn')) {
    document.getElementById('add-event-btn').onclick = () => {
        const text = document.getElementById('event-input') ? document.getElementById('event-input').value.trim() : '';
        const user = firebase.auth().currentUser;
        if (!user || !calSelectedDateStr || !text) {
            if(!calSelectedDateStr) alert('請先在月曆上點選一個日期喔！');
            return;
        }

        database.ref(`users/${user.uid}/calendar/${calSelectedDateStr}`).push({
            task: text,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            if (document.getElementById('event-input')) document.getElementById('event-input').value = '';
            loadCalendarEventsModule(calSelectedDateStr);
        });
    };
}

// 讀取行事曆日程
function loadCalendarEventsModule(dateStr) {
    const user = firebase.auth().currentUser;
    if (!user || !document.getElementById('event-list')) return;

    database.ref(`users/${user.uid}/calendar/${dateStr}`).on('value', (snapshot) => {
        const listEvent = document.getElementById('event-list');
        listEvent.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            listEvent.innerHTML = '<li style="color:#aaa; list-style:none; font-size:14px; padding: 4px;">當天還沒有排入複習任務。</li>';
            return;
        }
        Object.keys(data).forEach(key => {
            const li = document.createElement('li');
            li.style.cssText = "margin-bottom: 8px; font-size:14px; list-style: none; color: #fff; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid #00E5FF;";
            li.textContent = `🔹 ${data[key].task}`;
            listEvent.appendChild(li);
        });
    });
}

// 🔐 額外側邊欄按鈕狀態安全保護
if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            if (document.getElementById('menu-toggle-btn')) document.getElementById('menu-toggle-btn').style.display = 'block';
        } else {
            if (document.getElementById('menu-toggle-btn')) document.getElementById('menu-toggle-btn').style.display = 'none';
            if (document.getElementById('side-drawer')) document.getElementById('side-drawer').style.left = '-500px';
        }
    });
}
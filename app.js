const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const googleLoginButton = document.getElementById('google-login');
const signOutButton = document.getElementById('sign-out');
const userDisplay = document.getElementById('user-display');
const searchButton = document.getElementById('search-button');
const wordInput = document.getElementById('word-input');
const resultCard = document.getElementById('result-card');

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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ==========================================
// 2. 登入狀態監聽與 UI 切換
// ==========================================
function showSection(section) {
  if (section === 'login') {
    loginSection.classList.remove('hidden');
    appSection.classList.add('hidden');
  } else {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
  }
}

auth.onAuthStateChanged((user) => {
  if (user) {
    userDisplay.textContent = user.displayName || user.email || '讀者';
    showSection('app');
    loadBookshelf();         
    initCalendar(); // 🌟 登入成功後載入專業行事曆
  } else {
    showSection('login');
  }
});

if (googleLoginButton) {
    googleLoginButton.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    });
}
signOutButton.addEventListener('click', () => auth.signOut());

// ==========================================
// 3. 🌟 核心：FullCalendar 專業行事曆模組
// ==========================================
let calendar; // 全局變數存放行事曆實體

function initCalendar() {
    const calendarEl = document.getElementById('calendar-container');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'zh-tw',       // 中文介面
        initialView: 'dayGridMonth', // 預設月視圖
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            // 完美符合妳要求的視圖：年(外掛)、月、週、三日、單日
            right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridThreeDay,timeGridDay'
        },
        views: {
            timeGridThreeDay: {
                type: 'timeGrid',
                duration: { days: 3 },
                buttonText: '三日'
            }
        },
        editable: true,         // ✅ 允許拖曳！
        eventDurationEditable: true, // 允許拉長時間
        dayMaxEvents: 5,        // ✅ 最多顯示5個，超過會變成「+更多」
        height: 'auto',         // 自適應高度
        
        // 抓取 Firebase 資料塞給行事曆
        events: function(fetchInfo, successCallback, failureCallback) {
            const user = auth.currentUser;
            if (!user) { successCallback([]); return; }
            
            // 讀取 users/{uid}/professional_calendar 底下的任務
            database.ref(`users/${user.uid}/professional_calendar`).once('value')
            .then((snapshot) => {
                const events = [];
                const data = snapshot.val();
                if (data) {
                    Object.keys(data).forEach(key => {
                        events.push({
                            id: key,                  // Firebase 節點 key
                            title: data[key].title,
                            start: data[key].start,
                            end: data[key].end,
                            backgroundColor: data[key].color || '#E040FB',
                            borderColor: data[key].color || '#E040FB'
                        });
                    });
                }
                successCallback(events);
            }).catch(failureCallback);
        },

        // ✅ 當使用者「拖曳」行程時，自動更新 Firebase 的時間！
        eventDrop: function(info) {
            updateEventTimeInFirebase(info.event);
        },
        // 當使用者「拉長」區塊時，更新結束時間
        eventResize: function(info) {
            updateEventTimeInFirebase(info.event);
        }
    });
    
    calendar.render();
}

function updateEventTimeInFirebase(eventObj) {
    const user = auth.currentUser;
    if (!user) return;
    
    // 轉換為 ISO 格式存入資料庫
    const newStart = eventObj.start ? eventObj.start.toISOString() : null;
    const newEnd = eventObj.end ? eventObj.end.toISOString() : null;
    
    database.ref(`users/${user.uid}/professional_calendar/${eventObj.id}`).update({
        start: newStart,
        end: newEnd
    }).then(() => {
        console.log("行程時間已更新！");
    });
}

// ==========================================
// 4. 新增行程表單控制 (右下角 + 號)
// ==========================================
const fabBtn = document.getElementById('fab-add-event');
const modalOverlay = document.getElementById('event-modal-overlay');
const cancelBtn = document.getElementById('modal-cancel-btn');
const saveBtn = document.getElementById('modal-save-btn');

// 打開表單
fabBtn.addEventListener('click', () => {
    document.getElementById('modal-title').value = '';
    // 預設時間填入現在
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('modal-start').value = now.toISOString().slice(0,16);
    modalOverlay.style.display = 'flex';
});

// 關閉表單
cancelBtn.addEventListener('click', () => modalOverlay.style.display = 'none');

// 儲存資料到 Firebase
saveBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return alert("請先登入！");

    const title = document.getElementById('modal-title').value.trim();
    const start = document.getElementById('modal-start').value;
    const end = document.getElementById('modal-end').value;
    const color = document.getElementById('modal-color').value;

    if (!title || !start) return alert("名稱和開始時間必填喔！");

    // 將時間轉為 ISO 格式確保跨時區正確
    const startDate = new Date(start).toISOString();
    const endDate = end ? new Date(end).toISOString() : null;

    // 存入 Firebase
    database.ref(`users/${user.uid}/professional_calendar`).push({
        title: title,
        start: startDate,
        end: endDate,
        color: color,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        modalOverlay.style.display = 'none';
        calendar.refetchEvents(); // 讓行事曆重新整理抓資料
    }).catch(err => alert("儲存失敗：" + err));
});


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
// 6. 查單字與書架功能 (保留妳原本寫好的邏輯)
// ==========================================
// API 查詢
// ==========================================
// 6. 查單字與書架功能 (升級版：加入雙 API 連動翻譯)
// ==========================================
searchButton.addEventListener('click', () => {
    const word = wordInput.value.trim().toLowerCase();
    if (!word) return;
    
    document.getElementById('search-button').innerText = "解析中..."; // 給點回饋
    
    // API 1: 查英文定義與音標
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      .then(res => res.json())
      .then(data => {
        const entry = Array.isArray(data) ? data[0] : data;
        document.getElementById('result-word').textContent = entry.word;
        document.getElementById('result-phonetic').textContent = entry.phonetics[0]?.text || '';
        document.getElementById('result-definition').innerHTML = `<li>${entry.meanings[0]?.definitions[0]?.definition || '無'}</li>`;
        document.getElementById('result-example').innerHTML = `<li>${entry.meanings[0]?.definitions[0]?.example || '無'}</li>`;
        
        // API 2: 呼叫 MyMemory 翻譯 API 抓中文
        return fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-TW`);
      })
      .then(res => res.json())
      .then(transData => {
        const chineseDef = transData.responseData.translatedText;
        // 把中文翻譯塞進介面 (動態在英文定義前面加上中文)
        document.getElementById('result-definition').innerHTML = 
            `<li><strong style="color:#00E5FF;">[中文] ${chineseDef}</strong></li>` + 
            document.getElementById('result-definition').innerHTML;
            
        resultCard.classList.remove('hidden');
        document.getElementById('search-button').innerText = "解析";

        // 跳出儲存提示
        setTimeout(() => {
            document.getElementById('result-word-b').innerText = `想要儲存「${word}」嗎？`;
            document.getElementById('search-result-container').style.display = 'block';
        }, 800);
      })
      .catch(() => {
          alert('查無此單字或網路錯誤');
          document.getElementById('search-button').innerText = "解析";
      });
});

// 書架儲存相關
let userFoldersList = ["📥 未分類查詢紀錄"]; 

document.getElementById('create-folder-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    const folderName = document.getElementById('new-folder-input').value.trim();
    if (!user || !folderName) return;
    database.ref(`users/${user.uid}/customFolders/${folderName}`).set(true)
    .then(() => { alert("建立成功"); loadBookshelf(); });
});

document.getElementById('save-vocab-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    const word = document.getElementById('result-word').innerText.toLowerCase();
    let folder = document.getElementById('folder-select').value || "📥 未分類查詢紀錄";
    const def = document.getElementById('result-definition').innerText;
    const ex = document.getElementById('result-example').innerText;

    database.ref(`users/${user.uid}/folders/${folder}/${word}`).set({
        translation: def, usage: "自訂資料夾收藏", example: ex
    }).then(() => { alert("儲存成功！"); loadBookshelf(); });
});

function loadBookshelf() {
    const user = auth.currentUser;
    if (!user) return;
    userFoldersList = ["📥 未分類查詢紀錄"];
    database.ref(`users/${user.uid}/customFolders`).once('value', (snap) => {
        if (snap.exists()) Object.keys(snap.val()).forEach(f => userFoldersList.push(f));
        updateDropdownOptions();
        
        database.ref(`users/${user.uid}/folders`).once('value', (vSnap) => {
            const data = vSnap.val() || {};
            const bookshelf = document.getElementById('bookshelf');
            bookshelf.innerHTML = '';
            userFoldersList.forEach(folderName => {
                const count = data[folderName] ? Object.keys(data[folderName]).length : 0;
                const btn = document.createElement('button');
                btn.innerHTML = `📔 ${folderName} (${count})`;
                btn.style.cssText = "padding:10px; background:rgba(255,255,255,0.1); color:white; border-radius:5px; border:none; margin:5px; cursor:pointer;";
                btn.onclick = () => { if(count>0) startReviewSession(folderName, data[folderName]); else alert("空的"); };
                bookshelf.appendChild(btn);
            });
        });
    });
}

function updateDropdownOptions() {
    const sel = document.getElementById('folder-select');
    if(!sel) return;
    sel.innerHTML = '';
    userFoldersList.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f; opt.innerText = f; sel.appendChild(opt);
    });
}

// 字卡複習
let currentReviewList = [];
let currentCardIndex = 0;

function startReviewSession(folderName, wordsData) {
    currentReviewList = Object.keys(wordsData).map(w => ({
        word: w, translation: wordsData[w].translation, usage: wordsData[w].usage, example: wordsData[w].example
    }));
    currentCardIndex = 0;
    document.getElementById('current-folder-title').innerText = `正在複習：${folderName}`;
    document.getElementById('review-card-container').style.display = 'block';
    renderCard();
}

function renderCard() {
    if(!currentReviewList.length) return;
    const item = currentReviewList[currentCardIndex];
    document.getElementById('card-word').innerText = item.word;
    document.getElementById('card-translation').innerText = item.translation;
    document.getElementById('card-usage').innerText = item.usage;
    document.getElementById('card-example').innerText = item.example;
    document.getElementById('card-back').style.display = 'none';
}

document.getElementById('vocab-card').addEventListener('click', () => {
    const back = document.getElementById('card-back');
    back.style.display = back.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('prev-card').onclick = () => { currentCardIndex = (currentCardIndex - 1 + currentReviewList.length) % currentReviewList.length; renderCard(); };
document.getElementById('next-card').onclick = () => { currentCardIndex = (currentCardIndex + 1) % currentReviewList.length; renderCard(); };
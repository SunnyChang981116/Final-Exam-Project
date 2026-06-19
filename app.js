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
        
        // 抓取 Firebase 資料塞給行事曆 (保留妳原本完美的設定)
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
        },

        // 🌟🌟🌟 新加的功能：點擊現有行程，跳出視窗並顯示刪除按鈕 🌟🌟🌟
        eventClick: function(info) {
            const eventObj = info.event;
            
            // 1. 把行程的原本資料填入 Modal 輸入框中
            document.getElementById('modal-title').value = eventObj.title;
            if (eventObj.startStr) {
                document.getElementById('modal-start').value = eventObj.startStr.slice(0, 16);
            }
            if (eventObj.endStr) {
                document.getElementById('modal-end').value = eventObj.endStr.slice(0, 16);
            } else {
                document.getElementById('modal-end').value = '';
            }
            document.getElementById('modal-color').value = eventObj.backgroundColor;
            
            // 2. 顯示「刪除行程」按鈕！
            const deleteBtn = document.getElementById('delete-event-btn');
            if (deleteBtn) {
                deleteBtn.style.display = 'block'; // 讓刪除按鈕現形
                
                // 3. 綁定刪除按鈕的點擊動作
                deleteBtn.onclick = function() {
                    if (confirm(`確定要刪除行程「${eventObj.title}」嗎？`)) {
                        const user = auth.currentUser;
                        if (!user) return;
                        
                        // ⚠️ 這裡已經幫妳修正為正確的 professional_calendar 路徑！
                        database.ref(`users/${user.uid}/professional_calendar/${eventObj.id}`).remove()
                        .then(() => {
                            alert("行程已成功刪除！");
                            eventObj.remove(); // 同步把網頁畫面上的行程消滅
                            document.getElementById('event-modal-overlay').style.display = 'none'; // 關閉視窗
                        })
                        .catch(err => alert("刪除失敗：" + err));
                    }
                };
            }
            
            // 4. 打開彈出視窗
            document.getElementById('event-modal-overlay').style.display = 'flex';
        }
        // 🌟🌟🌟 新加的功能結束 🌟🌟🌟
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
    // 預設時間填入現在 (保留妳原本超棒的設計)
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('modal-start').value = now.toISOString().slice(0,16);
    document.getElementById('modal-end').value = ''; // 順便確保結束時間是空的
    modalOverlay.style.display = 'flex';

    // 🌟 核心關鍵：這是「新增全新行程」，所以把刪除按鈕藏起來！
    const deleteBtn = document.getElementById('delete-event-btn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
});

// 關閉表單
cancelBtn.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    
    // 🌟 關閉時也順便把刪除按鈕藏起來
    const deleteBtn = document.getElementById('delete-event-btn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
});

// 儲存資料到 Firebase (這段完全保留妳原本寫的！)
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

// ==========================================
// 7. 字卡複習與刪除單字功能 (升級版)
// ==========================================
let currentReviewList = [];
let currentCardIndex = 0;
let currentReviewFolderName = ""; // 紀錄當前在複習哪一個資料夾

function startReviewSession(folderName, wordsData) {
    currentReviewFolderName = folderName; // 記住資料夾名稱
    currentReviewList = Object.keys(wordsData).map(w => ({
        word: w, 
        translation: wordsData[w].translation, 
        usage: wordsData[w].usage, 
        example: wordsData[w].example
    }));
    currentCardIndex = 0;
    document.getElementById('current-folder-title').innerText = `正在複習：${folderName}`;
    document.getElementById('review-card-container').style.display = 'block';
    renderCard();
}

function renderCard() {
    const container = document.getElementById('review-card-container');
    
    // 如果單字被刪光了，隱藏字卡區域並重新整理書架
    if (!currentReviewList.length) {
        alert("這個資料夾裡面已經沒有單字囉！");
        container.style.display = 'none';
        loadBookshelf();
        return;
    }
    
    const item = currentReviewList[currentCardIndex];
    document.getElementById('card-word').innerText = item.word;
    document.getElementById('card-translation').innerText = item.translation;
    document.getElementById('card-usage').innerText = item.usage;
    document.getElementById('card-example').innerText = item.example;
    document.getElementById('card-back').style.display = 'none';
    
    // 🌟 動態加入「刪除單字」按鈕 (如果還沒有的話)
    let deleteBtn = document.getElementById('delete-vocab-btn');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'delete-vocab-btn';
        deleteBtn.innerHTML = '🗑️ 刪除此單字';
        deleteBtn.style.cssText = "margin-top: 15px; padding: 8px 16px; background: #FF5252; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%;";
        // 把刪除按鈕塞在字卡背面裡面，看答案時才可以刪除
        document.getElementById('card-back').appendChild(deleteBtn);
    }
    
    // 🌟 刪除按鈕的點擊邏輯
    deleteBtn.onclick = (e) => {
        e.stopPropagation(); // 防止觸發字卡翻面的點擊事件
        
        if (confirm(`確定要從【${currentReviewFolderName}】刪除「${item.word}」嗎？`)) {
            const user = auth.currentUser;
            if (!user) return;
            
            // 從 Firebase 資料庫移除該單字節點
            database.ref(`users/${user.uid}/folders/${currentReviewFolderName}/${item.word}`).remove()
            .then(() => {
                alert("刪除成功！");
                // 從目前的暫存陣列中移除該單字
                currentReviewList.splice(currentCardIndex, 1);
                
                // 調整索引指針，避免陣列溢出
                if (currentCardIndex >= currentReviewList.length) {
                    currentCardIndex = 0; 
                }
                
                // 重新渲染畫面
                renderCard();
                // 後台偷偷重新整理書架上的單字計數
                loadBookshelf();
            })
            .catch(err => alert("刪除失敗：" + err));
        }
    };
}

// 字卡點擊翻面
document.getElementById('vocab-card').addEventListener('click', () => {
    const back = document.getElementById('card-back');
    back.style.display = back.style.display === 'none' ? 'block' : 'none';
});

// 上下張切換
document.getElementById('prev-card').onclick = () => { 
    if(!currentReviewList.length) return;
    currentCardIndex = (currentCardIndex - 1 + currentReviewList.length) % currentReviewList.length; 
    renderCard(); 
};
document.getElementById('next-card').onclick = () => { 
    if(!currentReviewList.length) return;
    currentCardIndex = (currentCardIndex + 1) % currentReviewList.length; 
    renderCard(); 
};
const express = require('express');
const mineflayer = require('mineflayer');
const readline = require('readline');

// ==========================================
// BĂNG DÍNH 3 LỚP: DÁN MỒM LỖI CHUNK NGỨA MẮT
// ==========================================
const originalLog = console.log;
console.log = function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('Ignoring block entities')) return;
    originalLog.apply(console, args);
};
const originalWarn = console.warn;
console.warn = function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('Ignoring block entities')) return;
    originalWarn.apply(console, args);
};
const originalError = console.error;
console.error = function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('Ignoring block entities')) return;
    originalError.apply(console, args);
};

const RECONNECT_DELAY = 30000; 

const app = express(); // <--- ĐÃ FIX SẠCH SẼ CHỖ NÀY CHO BRO!
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Fonggggg đang Farm VIP Pro!'));
app.listen(port, () => console.log(`[Web] Server đang chạy trên port ${port}`));

process.on('uncaughtException', (err) => console.log('[Khiên Bất Tử] Chặn lỗi:', err.message));
process.on('unhandledRejection', (err) => console.log('[Khiên Bất Tử] Lỗi Promise:', err.message));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// TRẠNG THÁI GỐC CỦA BOT
let botState = 'DISCONNECTED'; 
let currentBot; 
let isLoggingIn = false; 
let isComboRunning = false; 
let isGUIOpen = false; 
let failCount = 0;
let isSonarKick = false; 
let sonarInterval = null; 

function createBot() {
    const bot = mineflayer.createBot({
        host: 'aemine.vn',
        port: 25565,
        username: 'MyCapCap', 
        version: '1.12.2',
        viewDistance: 'tiny', 
        checkTimeoutInterval: 60000,
        respawn: false 
    });

    currentBot = bot; 

    bot.once('login', () => {
        bot._client.on('disconnect', (packet) => {
            try {
                const reason = JSON.stringify(packet.reason);
                console.log(`[Hệ Thống] Bị ngắt kết nối: ${reason}`);
                if (reason.includes('xác minh') || reason.includes('thành công')) {
                    isSonarKick = true;
                }
            } catch (e) {}
        });
    });

    bot.on('message', (jsonMsg) => {
        if (jsonMsg.toAnsi) originalLog('[Chat] ' + jsonMsg.toAnsi());
        else originalLog('[Chat] ' + jsonMsg.toString());
    });

    bot.on('spawn', async () => {
        if (!isLoggingIn) { 
            isLoggingIn = true;
            console.log('[Hub] Đã kết nối server, chuẩn bị đăng nhập...');
            await sleep(2000);
            bot.chat('/dn serverqq'); 
            console.log('[Hub] Đã gửi lệnh login! Đang nghe ngóng...');
            botState = 'FIRST_LOGIN';
        }
    });

    bot.on('messagestr', (message) => {
        const lowerMsg = message.toLowerCase();

        // 1. TỰ ĐỘNG GIẢI CAPTCHA
        if (lowerMsg.includes('/captcha')) {
            const match = message.match(/\/captcha\s+([a-zA-Z0-9]+)/i);
            if (match) {
                console.log(`[Bảo Mật] Server đòi Captcha! Đang tự động nhập: /captcha ${match[1]} ...`);
                setTimeout(() => bot.chat(`/captcha ${match[1]}`), 1000); 
            }
        }

        // 1.5. LÌ LỢM ĐĂNG NHẬP
        if (lowerMsg.includes('đăng nhập bằng lệnh: /dn') || lowerMsg.includes('vui lòng đăng nhập')) {
            setTimeout(() => bot.chat('/dn Windvu@2#1#9#30849009630'), 1500); 
        }

        // ==========================================
        // BƯỚC 1: NHẬN DIỆN SONAR ĐANG QUÉT
        // ==========================================
        if (lowerMsg.includes('sonar') && lowerMsg.includes('xác minh')) {
            console.log('>>> [Anti-Bot] Bị Sonar soi! Kích hoạt chế độ giả lập gói tin người thật (20Hz)...');
            bot.clearControlStates();
            botState = 'WAIT_AUTO';
            isSonarKick = true; 

            if (sonarInterval) clearInterval(sonarInterval);

            sonarInterval = setInterval(() => {
                if (botState === 'WAIT_AUTO' && bot._client && bot.entity && bot.entity.position) {
                    try {
                        const jitterYaw = bot.entity.yaw + (Math.random() - 0.5) * 0.05;
                        const jitterPitch = bot.entity.pitch + (Math.random() - 0.5) * 0.05;

                        bot._client.write('position_look', {
                            x: bot.entity.position.x,
                            y: bot.entity.position.y,
                            z: bot.entity.position.z,
                            yaw: jitterYaw,
                            pitch: jitterPitch,
                            onGround: true
                        });
                    } catch (e) {}
                }
            }, 50); 
        }

        // --- BỘ LỌC TỰ ĐỘNG JOIN PARTY ---
        if (message.includes('/pt join')) {
            const match = message.match(/\/pt join (\S+)/);
            if (match) {
                console.log(`[Party] Phát hiện lời mời từ anh em: ${match[1]}! Đang quất lệnh join...`);
                setTimeout(() => bot.chat(`/party join ${match[1]}`), 500);
            }
        }

        // ==========================================
        // 2. BẢO TRÌ/KICK -> ÉP VỀ HUB VÀ TỰ BẤM LA BÀN
        // ==========================================
        if (lowerMsg.includes('kicked from') || lowerMsg.includes('bảo trì') || lowerMsg.includes('đã đóng')) {
            console.log('[Hệ Thống] Bị ném ra Sảnh (Bảo trì/Kick)! Chuyển sang chế độ TỰ ĐỤC LỖ vô lại...');
            botState = 'IN_HUB'; 
            isComboRunning = false; 
        }

        const isKilledByPlayer = message.includes(bot.username) && 
                                 (lowerMsg.includes('slain by') || 
                                  lowerMsg.includes('slained by') || 
                                  lowerMsg.includes('giết'));
        if (isKilledByPlayer) {
            console.log('[RÚT LUI KHẨN CẤP] Bị KS! Nằm im giả chết chờ server kick AFK...');
        }
        
        if (message.includes('không thể ngồi trong không khí')) {
            setTimeout(() => { if (botState === 'FARMING') bot.chat('/sit'); }, 3000);
        }

        // ==============================================================
        // KHÓA HUB: MỞ RỘNG MẮT THẦN ĐỂ TỰ MÚA KHI VÔ GAME
        // ==============================================================
        const hasJoinMessage = lowerMsg.includes('vừa tham gia máy chủ') && lowerMsg.includes(bot.username.toLowerCase());
        const hasGameMessage = lowerMsg.includes('boss') || lowerMsg.includes('tài xỉu') || lowerMsg.includes('nô lệ') || lowerMsg.includes('thế giới') || lowerMsg.includes('thủ lĩnh');
        
        if (botState !== 'FARMING' && (hasJoinMessage || hasGameMessage)) {
            console.log(`[Mắt Thần] Thấy thông báo vô game! ĐÃ LỌT VÀO CỤM FARM AN TOÀN! Khóa Hub, Bắt đầu múa!`);
            botState = 'FARMING';
            isComboRunning = false; 
            startFarmingProcess(bot);
        }
    });

    // ==========================================
    // LA BÀN TỰ ĐỘNG: CỨ Ở HUB LÀ TỰ BẤM
    // ==========================================
    setInterval(() => {
        if (!currentBot || !currentBot.inventory) return;
        if (botState === 'FARMING' || botState === 'WAIT_AUTO') return; 

        const items = currentBot.inventory.items();
        const hasCompass = items.some(i => i.name === 'compass');

        if (hasCompass) {
            botState = 'IN_HUB'; 
            if (!isGUIOpen) {
                console.log('[Hub] Thấy La Bàn Sảnh! Tiến hành click Menu (Tự túc)...');
                currentBot.setQuickBarSlot(4);
                currentBot.activateItem();
            }
        } 
    }, 3000); 

    bot.on('windowOpen', async (window) => {
        if (isGUIOpen || botState === 'WAIT_AUTO') return; 
        isGUIOpen = true; 
        try {
            console.log('[Menu] Đang mở GUI...');
            await sleep(2000);
            await bot.clickWindow(20, 0, 0); 
            await sleep(2000);
            await bot.clickWindow(14, 0, 0); 
            console.log('[Menu] Đã click xong! Chờ server bế vào cụm...');
        } catch (err) {
            console.log('Lỗi click GUI:', err.message);
        } finally {
            isGUIOpen = false; 
        }
    });

    bot.on('kicked', (reason) => {
        let reasonStr = '';
        try { reasonStr = JSON.stringify(reason); } 
        catch (e) { reasonStr = reason.toString(); }
        
        if (reasonStr.toLowerCase().includes('xác minh') || reasonStr.toLowerCase().includes('thành công') || reasonStr.toLowerCase().includes('vượt qua')) {
            console.log('>>> [Anti-Bot] Đã đọc được bảng "XÁC MINH THÀNH CÔNG" từ server!');
            isSonarKick = true; 
        }
    });

    bot.on('death', () => {
        bot.clearControlStates();
        isComboRunning = false;
        if (botState !== 'FARMING') {
            console.log('[CẢNH BÁO] Bot chết ở Sảnh! Đang tự động ấn Hồi Sinh...');
            setTimeout(() => bot.respawn(), 2000);
        } else {
            console.log('[CẢNH BÁO] Bot bị giết trong cụm Farm! Nằm phơi xác...');
        }
    });

    bot.on('end', () => {
        console.log('[SERVER] Đã bị văng hẳn khỏi cụm máy chủ!');
        isLoggingIn = false;
        botState = 'DISCONNECTED'; 

        if (sonarInterval) {
            clearInterval(sonarInterval);
            sonarInterval = null;
        }

        // ==========================================
        // BƯỚC 3: ĐẾM NGƯỢC 12 GIÂY ĐỂ REJOIN
        // ==========================================
        if (isSonarKick) {
            isSonarKick = false; 
            failCount = 0; 
            console.log(`[Anti-Bot] Đang chờ 12 giây để server cập nhật danh sách...`);
            
            let waitTime = 12;
            const countdownInterval = setInterval(() => {
                console.log(`... Đang đếm ngược: ${waitTime} giây nữa sẽ vô lại ...`);
                waitTime--;
                
                if (waitTime <= 0) {
                    clearInterval(countdownInterval);
                    console.log(`[Anti-Bot] Hết giờ! Phi thẳng vô cụm lượm lúa!!!`);
                    createBot();
                }
            }, 1000); 
            return; 
        }

        failCount++;
        if (failCount >= 5) {
            console.log(`[BÁO ĐỘNG] Rớt mạng ${failCount} lần! Ngủ đông một chút...`);
            failCount = 0; 
            setTimeout(createBot, 40000); 
            return;
        }
        console.log(`[Mất mạng] Lần rớt thứ ${failCount}. Đợi ${RECONNECT_DELAY/1000} giây để vào lại...`);
        setTimeout(createBot, RECONNECT_DELAY);
    });
}

// ==================================================
// KỊCH BẢN MÚA CỦA PHÁP SƯ
// ==================================================
async function startFarmingProcess(bot) {
    if (isComboRunning) return; 
    isComboRunning = true;

    try {
        bot.setQuickBarSlot(0); 
        await sleep(2000);
        bot.chat('/spawn');
        await sleep(120000);
        console.log('[Farm] Vận nội công: Đè Shift + Trái + Phải...');
        
        bot.setControlState('sneak', true); 
        await sleep(500); 
        
        bot.swingArm('right'); 
        await sleep(400); 
        
        bot.activateItem(); 
        await sleep(400); 
        
        bot.setControlState('sneak', false); 
        bot.clearControlStates(); 
        bot.setControlState('forward', true);
        bot.setControlState('sprint', true);
        await sleep(500);
        bot.clearControlStates();
        console.log('[Farm] Đã xuất chiêu xong, chuẩn bị biến về...');
        await sleep(5000); 

        bot.chat('/home'); 
        await sleep(6000); 
        
        bot.chat('/sit');
        console.log('[Farm] Đã đến bãi, nằm xuống nhập định!');
        failCount = 0; 

    } catch (err) {
        console.log('[Farm] Lỗi:', err.message);
    } finally {
        isComboRunning = false; 
    }
}

// ==========================================
// TÍNH NĂNG CHAT TỪ REPLIT VÀO GAME
// ==========================================
let lastChatTime = 0;
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    if (currentBot) {
        const now = Date.now();
        if (now - lastChatTime < 1500) {
            console.log('>>> [CẢNH BÁO] Gõ chậm thôi! Kẻo server nó khóa mõm!');
            return;
        }
        lastChatTime = now;
        currentBot.chat(input); 
        console.log(`[Bạn Đã Chat]: ${input}`);
    } else {
        console.log('[Lỗi] Bot chưa vào game, không chat được!');
    }
});

createBot();

# Legacy Đấu Trường (bản làm lại)

Game đối kháng **1v1 điều khiển trực tiếp**, lấy gameplay từ bản Legacy: **điểm văng %**, lực đẩy, cột chắn, **rơi đài** và **mạng (stock)**. Chơi **offline với máy** hoặc **online 2 người** qua WebRTC P2P (PeerJS). Chạy được trên **PC** (bàn phím + chuột) và **điện thoại** (cần ảo + nút chiêu).

Đây là bản viết lại từ đầu, gọn hơn bản `legacy/` (bản cũ để nguyên để đối chiếu). Không cần build, không cần máy chủ riêng: mở thẳng `arena/index.html` trên GitHub Pages.

- GitHub Pages: `https://<tài-khoản>.github.io/auto-bat/arena/`
- Chạy máy mình: `cd auto-bat && python3 -m http.server 8765` rồi mở `http://localhost:8765/arena/`

## Luật

- Mỗi đòn trúng cộng điểm văng cho đối thủ; điểm càng cao bị đánh văng càng xa (công thức như Legacy: `lực = (kb + kg·0.64·%) / trọng lượng`).
- Văng ra ngoài mép sàn là rơi đài, mất 1 mạng, hồi sinh sau 1.3s với 2s bất tử. Tự đi bộ không thể rơi khỏi sàn.
- Hết mạng thì thua. Hết giờ thì bên còn nhiều mạng hơn thắng, nếu bằng nhau thì bên ít điểm văng hơn thắng.
- Bị văng mạnh vào cột: choáng 0.3s, +1.5%.
- Chiêu: **A** đánh thường • **B** kết liễu • **C** phòng thủ/cơ động • **D** đặc kỹ • **Nộ** khi thanh nộ đầy (tích khi đánh và khi bị đánh).

## Điều khiển

| | PC | Điện thoại |
| --- | --- | --- |
| Di chuyển | WASD / mũi tên | Chạm nửa trái màn hình (cần ảo hiện tại chỗ chạm) |
| Ngắm | Chuột | Chạm nhanh = tự ngắm đối thủ • Giữ và kéo = ngắm tay |
| A / B / C / D / Nộ | Chuột trái hoặc Q / Chuột phải hoặc E / Shift hoặc R / F / Space | 5 nút bên phải |
| Hủy chiêu | — | Kéo vào ô ✕ Hủy rồi thả |
| Tạm dừng | Esc | Nút ⏸ |

Giữ A để đánh liên tục. Chiêu tụ lực (Đại Hỏa Cầu, Kéo Căng Dây, Đấm Móc, Thế Thủ Tụ Lực): giữ nút rồi thả.

## 8 tướng

| Tướng | Vai trò | Điểm nhấn |
| --- | --- | --- |
| Valerius | Đỡ đòn | Giơ khiên chặn rồi húc khiên câm lặng; Nộ bất tử 5s |
| Gideon | Tiên phong | Điểm Ngọt ở mũi kiếm (x1.6 lực văng); gồng thân thép; chấn động diện rộng |
| Ryoma | Kiếm sĩ | Nối 2 chiêu khác nhau tạo Combo → Kiếm Khí phá đạn; Vô Ảnh Trảm đẩy ra mép |
| Vesper | Sát thủ | Đâm sau lưng x2; tàng hình; phi dao rồi dịch chuyển ra sau lưng |
| Ignatius | Pháp sư | Thiêu đốt cộng dồn; Đại Hỏa Cầu tụ lực; dịch chuyển; Thiên Thạch chọn điểm |
| Elara | Xạ thủ | Tập Trung sau 4s; kéo cung tụ lực xuyên thấu; nhảy lùi làm chậm; tên khổng lồ đuổi mục tiêu |
| Zero | Xạ thủ | Băng đạn 9 viên; khóa mục tiêu; Thiết Thân nhảy lùi; đạn nổ |
| Borg | Đấu sĩ | Đấm Móc lao tới hất tung; gồng tích lực trả đòn; túm ném theo hướng chọn; Lồng Đấu |

Thêm tướng: viết một object trong `src/engine/heroes.js` (chiêu là dữ liệu sự kiện `arc/line/circle/proj/dash/custom`), thêm cách vẽ vũ khí trong `render.js` nếu cần, rồi chạy `npm test` và `npm run balance`.

## Online

1. Người A bấm **Tạo phòng online** → nhận mã 6 ký tự (và link `?room=MÃ`).
2. Người B nhập mã → **Vào phòng**.
3. Hai người chọn tướng, chủ phòng chọn sàn/số mạng/thời gian, cả hai bấm **Sẵn sàng**.

Cách hoạt động:
- **Chủ phòng làm host**: chạy mô phỏng 60 tick/giây, gửi trạng thái rút gọn (tối đa ~1.5 KB) 30 lần/giây qua kênh WebRTC không tin cậy, nếu kênh đó không mở được thì gửi qua kênh tin cậy. Sự kiện hình/âm và input đi kênh tin cậy.
- **Khách** gửi input (di chuyển, hướng ngắm, nút giữ, *bộ đếm số lần bấm* nên không mất cú bấm), xem trận bằng nội suy và **dự đoán di chuyển của chính mình** để bớt cảm giác trễ.
- PeerJS Cloud (`0.peerjs.com`) chỉ dùng để ghép hai máy. Khi đã nối P2P thì dữ liệu trận đi thẳng giữa hai máy.
- Khách mất kết nối thì chủ phòng thắng và phòng vẫn mở để khách vào lại. Chủ phòng mất kết nối thì khách về menu.
- Có thể dùng broker/ICE riêng: đặt `window.ARENA_ONLINE_CONFIG = { peerjs: {host, port, path, secure}, iceServers: [...] }` trước khi tải `main.js`.

Giới hạn hiện tại: chủ phòng quyết định kết quả (phòng chơi giữa bạn bè, chưa chống gian lận); chưa có nối lại giữa trận; tab chủ phòng chạy nền có thể bị trình duyệt làm chậm.

## Cấu trúc

```text
src/engine/   Không DOM — chạy được trong Node để test
  math.js     tiện ích, RNG có seed
  arena.js    5 sàn đấu, hình học mép/cột
  world.js    trận đấu: vật lý, đánh trúng, lực văng, rơi đài, trạng thái, đạn, vùng
  heroes.js   8 tướng
  bot.js      bot offline (chỉ tạo input như người chơi; biết né đạn, né mép)
  view.js     rút gọn state để vẽ/gửi mạng, nội suy
src/game/     Trình duyệt
  main.js     menu, chọn tướng, phòng online, vòng lặp offline/host/khách
  render.js   vẽ Canvas 2D + HUD
  input.js    bàn phím/chuột + cần ảo/nút cảm ứng
  net.js      phòng PeerJS
  audio.js    âm thanh tổng hợp WebAudio (không cần file)
vendor/       PeerJS 1.5.5 (MIT)
tools/        mô phỏng hàng loạt, đo cân bằng, kiểm tra trình duyệt/online
```

## Kiểm tra

```sh
npm test                 # 128 trận bot vs bot mọi cặp tướng/sàn: không lỗi, không NaN, trận kết thúc
npm run balance          # tỉ lệ thắng, %/phút, KO ở bao nhiêu %
node tools/smoke.cjs http://127.0.0.1:8765/arena/index.html   # PC + điện thoại (Playwright)
node tools/online-smoke.cjs http://127.0.0.1:8765/arena/index.html 9000   # 2 trình duyệt online, cần PeerServer cục bộ cổng 9000
```

Cân bằng hiện được ước lượng bằng bot (mức Thường: tỉ lệ thắng 24–74%). Cần người thật chơi thử để chỉnh tiếp.

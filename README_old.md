# Mystery Box Web 3D — Prototype

เปิดโฟลเดอร์นี้ด้วย VS Code แล้วเปิด `index.html` ผ่าน Live Server หรือ web server ใด ๆ ที่รองรับ ES Modules

## สิ่งที่มีใน Prototype
- Lobby เว็บ 3D
- กล่อง 3D หมุน/ซูมได้
- กล่อง 5 ระดับ ราคา 1–5 แต้ม (แต้มจำลอง)
- หมวดอาหาร / เสื้อผ้า / ของใช้ / รางวัลใหญ่ / Legendary
- Modal เปิดกล่อง
- เอฟเฟกต์สั่น/หมุน + particles
- ระบบแต้มจำลอง
- รางวัลของฉัน
- Responsive สำหรับมือถือ
- พื้นหลังออกแบบด้วย CSS และสามารถเปลี่ยนเป็นรูปภาพเองได้

## เปลี่ยนรูปพื้นหลัง
แก้ `#background` ใน `styles.css` เช่น:
`background: linear-gradient(...), url('./assets/background.jpg') center/cover no-repeat;`

## หมายเหตุ
เป็น Prototype ฝั่งหน้าเว็บเท่านั้น ยังไม่มีระบบสมาชิกจริง, Supabase, SMS/OTP, payment หรือการสั่งซื้อ/จัดส่งจริง

Three.js โหลดจาก CDN จึงต้องมีอินเทอร์เน็ตขณะรัน Prototype

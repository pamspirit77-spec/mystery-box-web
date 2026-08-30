# Mystery Box 3D — ระบบแอดมิน

ไฟล์ที่เพิ่ม/แก้:
- `admin.html` — หน้า Admin Control แยกจากเกม
- `admin.js` / `admin.css` — Login + Dashboard
- `admin-control-setup.sql` — ตาราง/ฟังก์ชันสิทธิ์แอดมิน
- `online.js` + `app.js` + `index.html` + `styles.css` — รับคำสั่งควบคุมเว็บจาก Admin

## ความสามารถ
1. Login เฉพาะบัญชีที่อยู่ใน `admin_users`
2. ดูคำขอเติมเงินทั้งหมด
3. กรอง/ค้นหารายการเติมเงิน
4. Wallet: คัดลอกลิงก์และตรวจสอบก่อนอนุมัติ
5. TrueMoney: ดูรหัส 14 หลักและเปิดรูปหลักฐานแบบ signed URL
6. อนุมัติ/ปฏิเสธคำขอ
7. เมื่ออนุมัติ เหรียญจะเพิ่มใน Database แบบ atomic และอนุมัติซ้ำไม่ได้
8. ดูรายชื่อผู้เล่นและยอดเหรียญ
9. เพิ่ม/ลดเหรียญผู้เล่นจาก Admin
10. เปิด/ปิดโหมดปรับปรุงเว็บไซต์
11. ตั้งประกาศหน้าเว็บ

## ตั้งค่า Supabase
1. รัน `supabase-setup.sql`
2. รัน `admin-control-setup.sql`
3. เปิด Authentication และสร้างบัญชีอีเมลของแอดมิน
4. คัดลอก UUID ของบัญชีแอดมินจาก Authentication → Users
5. รัน:

```sql
insert into public.admin_users(user_id)
values ('UUID-ของแอดมิน')
on conflict (user_id) do nothing;
```

6. ใส่ `SUPABASE_URL` และ `SUPABASE_ANON_KEY` ใน `supabase-config.js`
7. เปิด `admin.html`

### สำคัญ
โปรเจกต์เวอร์ชันนี้ใช้ schema แบบ `auth.users` + `profiles` + `topup_requests.user_id`
ดังนั้น **อย่ารัน `topup-setup.sql` เก่าซ้ำ** เพราะไฟล์นั้นเป็นระบบ guest wallet คนละ schema

ห้ามใส่ Supabase `service_role` / Secret key ในไฟล์เว็บ

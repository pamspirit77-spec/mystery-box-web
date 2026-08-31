# แก้เฉพาะระบบบันทึกกล่องฝั่ง Admin

1. รัน `BOX_SETTINGS_SAVE_FIX_V2.sql` ใน Supabase SQL Editor **1 ครั้ง**
2. Deploy โฟลเดอร์นี้ขึ้น Render
3. เปิด Admin แล้วกด `Ctrl + F5`
4. แก้ชื่อ/ราคา/รางวัล/อัตราดรอป/รูป แล้วกด **บันทึกการตั้งค่ากล่องทั้งหมด**
5. กดยืนยัน

ระบบจะเรียก `admin_save_box_settings` ซึ่งเป็น RPC หลักจาก `BOX_SETTINGS_SETUP.sql` ก่อน และรองรับ `admin_save_box_settings_v2` เป็น fallback

ไม่มีการแก้ระบบเติมเงิน, ผู้เล่น, คลัง, ขอรับรางวัล หรือระบบอื่น

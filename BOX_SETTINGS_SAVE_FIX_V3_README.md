# BOX SETTINGS SAVE FIX V3

รัน `BOX_SETTINGS_SAVE_FIX_V3.sql` 1 ครั้งใน Supabase SQL Editor แล้ว Deploy ไฟล์ชุดนี้ขึ้น Render

จุดแก้เฉพาะระบบบันทึก box_settings: ใช้ RPC แบบ atomic, ตรวจสอบข้อมูลก่อนเขียน, แล้วหน้า Admin อ่านกลับจากฐานข้อมูลและตรวจสอบค่าหลังบันทึกอีกครั้ง

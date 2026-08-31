# V25 — Box Settings Admin Save Fix

แก้เฉพาะการตั้งค่ากล่องฝั่ง Admin

- ชื่อ/ชื่ออังกฤษ/ราคา/ระดับกล่อง
- เพิ่ม/ลบรางวัล
- ชื่อ/ระดับ/อัตราดรอปของรางวัล
- เพิ่ม/เปลี่ยนรูปภาพ
- บันทึกด้วย SECURITY DEFINER RPC ที่ตรวจ admin_users โดยตรง
- ไม่บังคับให้อัตราดรอปรวมต้องเท่ากับ 100%; เกมจะคำนวณแบบ weighted ตามค่าที่ตั้ง
- รูปถูกย่อและเก็บเป็น data URL ใน rewards JSON จึงไม่พึ่ง Storage policy
- หลังบันทึกอ่านจาก Supabase กลับมาตรวจ แล้วจึง reload หน้า Admin

ต้องรัน `BOX_SETTINGS_SAVE_V25.sql` ใน Supabase SQL Editor 1 ครั้งก่อนใช้งาน

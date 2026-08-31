from pathlib import Path
p=Path('/mnt/data/v30/index.html')
s=p.read_text()
s=s.replace('<button class="nav" data-page="boxes">📦 <span>กล่องสุ่ม</span></button>', '<button class="nav" data-page="boxes">📦 <span>กล่องสุ่ม</span></button>\n        <button class="nav" data-page="game">🐟 <span>เข้าเกม</span></button>')
marker='      <section class="account-page hidden" id="accountPage">'
insert=r'''      <section class="betta-page hidden" id="bettaPage">
        <div class="betta-hero">
          <div>
            <div class="eyebrow">BETTA FRONTIER</div>
            <h1>🐟 สนามปลากัด</h1>
            <p>ทีมปลาของคุณจะเคลื่อนที่และต่อสู้แบบอัตโนมัติ เลือกด่าน อัปเกรดทีม แล้วส่งลงสนาม</p>
          </div>
          <div class="betta-player-card"><span>ทีมของฉัน</span><b id="bettaTeamPower">พลัง 120</b><small id="bettaTeamLevel">ทีมเลเวล 1</small></div>
        </div>
        <div class="betta-tabs">
          <button class="betta-tab active" data-betta-mode="pve" type="button">⚔️ PVE ฟาร์ม</button>
          <button class="betta-tab" data-betta-mode="pvp" type="button">🏆 PVP ออนไลน์</button>
          <button class="betta-tab" data-betta-mode="team" type="button">🐠 ทีมของฉัน</button>
        </div>
        <div id="bettaPvePanel" class="betta-panel">
          <div class="stage-head"><div><h2>เลือกด่าน</h2><p>ผ่านด่านเพื่อรับ EXP และเหรียญฟาร์ม</p></div><span id="bettaEnergy">⚡ 10/10</span></div>
          <div class="stage-grid" id="bettaStageGrid"></div>
        </div>
        <div id="bettaPvpPanel" class="betta-panel hidden">
          <div class="pvp-card"><div class="pvp-emblem">⚔️</div><h2>อารีน่า PVP</h2><p>จับคู่คู่ต่อสู้ แล้วปล่อยทีมเข้าประชิดและต่อสู้แบบอัตโนมัติ</p><div class="pvp-stats"><span>🏆 Rating <b id="bettaRating">1000</b></span><span>🔥 ชนะ <b id="bettaWins">0</b></span><span>💀 แพ้ <b id="bettaLosses">0</b></span></div><button class="betta-primary" id="bettaFindMatch" type="button">ค้นหาคู่ต่อสู้</button></div>
        </div>
        <div id="bettaTeamPanel" class="betta-panel hidden">
          <div class="team-head"><div><h2>ทีมปลากัด</h2><p>อัปเกรดปลาเพื่อเพิ่มพลังโจมตีและความอึด</p></div><span id="bettaCoins">🪙 500</span></div>
          <div class="fish-team-grid" id="bettaTeamGrid"></div>
        </div>
      </section>

      <section class="betta-battle-page hidden" id="bettaBattlePage">
        <div class="battle-topbar"><button class="betta-back" id="bettaBattleBack" type="button">← กลับ</button><div><b id="bettaBattleTitle">ด่าน 1</b><small id="bettaBattleMode">PVE</small></div><span id="bettaBattleTimer">00:00</span></div>
        <div class="battle-arena" id="bettaArena">
          <div class="arena-bg"><div class="water-light light1"></div><div class="water-light light2"></div><div class="sand"></div><div class="plant plant1">🌿</div><div class="plant plant2">🌱</div><div class="bubble b1"></div><div class="bubble b2"></div></div>
          <div class="battle-hud player-hud"><div class="hud-name">🐟 <span id="bettaPlayerName">ทีมของฉัน</span></div><div class="hud-bar"><i id="bettaPlayerHp" style="width:100%"></i></div><small id="bettaPlayerHpText">100/100</small></div>
          <div class="battle-hud enemy-hud"><div class="hud-name"><span id="bettaEnemyName">ศัตรู</span> 🐟</div><div class="hud-bar enemy"><i id="bettaEnemyHp" style="width:100%"></i></div><small id="bettaEnemyHpText">100/100</small></div>
          <div class="lane" id="bettaLane"><div class="lane-unit player-unit" id="bettaPlayerUnit"><div class="fish-art player-fish"><div class="fish-tail"></div><div class="fish-body"></div><div class="fish-fin top"></div><div class="fish-fin bottom"></div><div class="fish-eye"></div></div><span class="unit-level" id="bettaPlayerUnitLevel">Lv.1</span></div><div class="lane-unit enemy-unit" id="bettaEnemyUnit"><div class="fish-art enemy-fish"><div class="fish-tail"></div><div class="fish-body"></div><div class="fish-fin top"></div><div class="fish-fin bottom"></div><div class="fish-eye"></div></div><span class="unit-level" id="bettaEnemyUnitLevel">Lv.1</span></div></div>
          <div class="battle-log" id="bettaBattleLog" aria-live="polite"></div>
          <div class="battle-result hidden" id="bettaBattleResult"><div class="result-icon" id="bettaResultIcon">🏆</div><h2 id="bettaResultTitle">ชนะ!</h2><p id="bettaResultText">ได้รับ EXP +20 และเหรียญ +30</p><button class="betta-primary" id="bettaResultBtn" type="button">กลับหน้าด่าน</button></div>
        </div>
      </section>
'''
s=s.replace(marker, insert+'\n'+marker)
p.write_text(s)

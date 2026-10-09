(() => {
const ctl = {x:0, y:0, act:false};
const $ = id => document.getElementById(id);
const joy=$('joy'), stick=$('stick'), btn=$('act'), dlg=$('dlg'), quest=$('quest');
let jid=null;
function jmove(e){
  const r=joy.getBoundingClientRect(), R=r.width/2, m=R*0.6;
  let dx=e.clientX-(r.left+R), dy=e.clientY-(r.top+R); const d=Math.hypot(dx,dy);
  if(d>m){dx*=m/d; dy*=m/d;}
  stick.style.transform=`translate(${dx}px,${dy}px)`; ctl.x=dx/m; ctl.y=dy/m;
}
joy.addEventListener('pointerdown',e=>{jid=e.pointerId; joy.setPointerCapture(jid); jmove(e); e.preventDefault();});
joy.addEventListener('pointermove',e=>{if(e.pointerId===jid) jmove(e);});
const jend=e=>{if(e.pointerId===jid){jid=null; ctl.x=ctl.y=0; stick.style.transform='';}};
joy.addEventListener('pointerup',jend); joy.addEventListener('pointercancel',jend);
btn.addEventListener('pointerdown',e=>{ctl.act=true; e.preventDefault();});
dlg.addEventListener('pointerdown',e=>{ctl.act=true; e.preventDefault();});

const hit=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;

class Room extends Phaser.Scene {
  constructor(room){ super('room'); this.room=room; this.flags={}; this.lines=null; }
  preload(){
    const R=this.room;
    R.floorTiles.forEach(k=>this.load.image(k,`assets/tiles/${k}.png`));
    new Set(R.objects.map(o=>o.key)).forEach(k=>this.load.image(k,`assets/objects/${k}.png`));
    this.load.image('player','assets/characters/player.png');
  }
  ph(k,w,h,c){ // texture de remplacement si le PNG est absent
    if(this.textures.exists(k)) return;
    const g=this.add.graphics(); g.fillStyle(c).fillRect(0,0,w,h).lineStyle(1,0xffffff,0.6).strokeRect(0,0,w,h);
    g.generateTexture(k,w,h); g.destroy();
  }
  create(){
    const R=this.room, T=R.tile;
    R.floorTiles.forEach(k=>this.ph(k,T,T,0x5a3a26));
    this.ph('player',14,22,0x8b2a35);
    R.objects.forEach(o=>this.ph(o.key,24,32,0xc9a24a));
    // mur de fond (provisoire, à remplacer par des modules de mur)
    const g=this.add.graphics().setDepth(0.5);
    g.fillStyle(0x2e2018).fillRect(0,0,R.width,R.wallHeight);
    g.fillStyle(0x3a2a1f); for(let y=8;y<R.wallHeight;y+=16) g.fillRect(0,y,R.width,2);
    g.fillStyle(0x4a3426).fillRect(0,R.wallHeight-6,R.width,6);
    // sol
    const rows=(R.height-R.wallHeight)/T, cols=R.width/T;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++)
      this.add.image(c*T,R.wallHeight+r*T,R.floorTiles[(c*7+r*3)%R.floorTiles.length]).setOrigin(0).setDepth(0);
    // objets : tri de profondeur par Y, collision par empreinte au sol
    this.solids=[]; this.talks=[];
    R.objects.forEach(o=>{
      const s=this.add.image(o.x,o.y,o.key).setOrigin(0.5,1);
      const floor=o.layer==='floor';
      s.setDepth(floor?1:o.y);
      const w=o.fp?o.fp[0]:s.width*0.85, h=o.fp?o.fp[1]:Phaser.Math.Clamp(s.height*0.22,6,14);
      o.rect={x:o.x-w/2,y:o.y-h,w,h};
      if(o.solid!==false && !floor) this.solids.push(o.rect);
      if(o.talk) this.talks.push(o);
    });
    this.p=this.add.image(R.player.x,R.player.y,'player').setOrigin(0.5,1);
    this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,E');
    this.updateQuest();
  }
  pressed(){
    const K=Phaser.Input.Keyboard.JustDown, k=this.keys;
    const a=ctl.act||K(k.SPACE)||K(k.ENTER)||K(k.E); ctl.act=false; return a;
  }
  move(dx,dy){
    const p=this.p, b=this.room.bounds;
    const nx=Phaser.Math.Clamp(p.x+dx,b.minX,b.maxX), ny=Phaser.Math.Clamp(p.y+dy,b.minY,b.maxY);
    const r={x:nx-5,y:ny-6,w:10,h:6};
    if(!this.solids.some(s=>hit(r,s))){p.x=nx; p.y=ny;}
  }
  update(t,dt){
    const a=this.pressed();
    if(this.lines){ if(a) this.nextLine(); return; }
    const k=this.keys; let dx=ctl.x, dy=ctl.y;
    if(k.LEFT.isDown||k.A.isDown) dx-=1; if(k.RIGHT.isDown||k.D.isDown) dx+=1;
    if(k.UP.isDown||k.W.isDown) dy-=1; if(k.DOWN.isDown||k.S.isDown) dy+=1;
    const m=Math.hypot(dx,dy); if(m>1){dx/=m; dy/=m;}
    const sp=this.room.player.speed*dt/1000;
    this.move(dx*sp,0); this.move(0,dy*sp);
    this.p.setDepth(this.p.y);
    const pr={x:this.p.x-5,y:this.p.y-6,w:10,h:6};
    this.near=this.talks.find(o=>hit(pr,{x:o.rect.x-14,y:o.rect.y-14,w:o.rect.w+28,h:o.rect.h+28}));
    btn.classList.toggle('on',!!this.near);
    if(a && this.near) this.talk(this.near);
  }
  talk(o){
    const f=this.flags;
    const e=o.talk.find(e=>(!e.needs||f[e.needs]) && (!e.not||!f[e.not]));
    if(!e) return;
    this.entry=e; this.lines=e.text.slice(); dlg.textContent=this.lines[0]; dlg.hidden=false;
  }
  nextLine(){
    this.lines.shift();
    if(this.lines.length){ dlg.textContent=this.lines[0]; return; }
    dlg.hidden=true; if(this.entry.sets) this.flags[this.entry.sets]=true;
    this.lines=null; this.updateQuest();
  }
  updateQuest(){
    const f=this.flags;
    quest.textContent = f.fini ? '✓ La page manquante' : f.page ? 'Rapporte la page au bureau' : 'Quête : trouve la page manquante';
  }
}

fetch('data/bibliotheque.json').then(r=>r.json()).then(room=>{
  new Phaser.Game({
    type:Phaser.AUTO, parent:'game', width:room.width, height:room.height,
    pixelArt:true, roundPixels:true, backgroundColor:'#1a1210',
    scale:{mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH},
    scene:[new Room(room)]
  });
});
})();

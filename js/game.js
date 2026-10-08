const GAME_W=960,GAME_H=540;
class LibraryScene extends Phaser.Scene{
constructor(){super("LibraryScene")}
preload(){
this.load.image("library","assets/environment/library_background.png");
this.load.spritesheet("thomas","assets/characters/thomas_sheet.png",{frameWidth:48,frameHeight:64});
this.load.spritesheet("cecile","assets/characters/cecile_sheet.png",{frameWidth:48,frameHeight:64});
this.load.image("cat","assets/characters/ti-chat.png");this.load.image("player","assets/characters/player.png")
}
create(){
this.physics.world.setBounds(24,44,912,471);this.add.image(480,270,"library").setDepth(0);
this.cecile=this.add.sprite(165,375,"cecile",0).setScale(.86).setOrigin(.5,.9).setDepth(375);
this.thomas=this.add.sprite(810,365,"thomas",0).setScale(.86).setOrigin(.5,.9).setDepth(365);
this.cat=this.add.image(690,445,"cat").setDisplaySize(54,54).setOrigin(.5,.9).setDepth(445);
this.player=this.physics.add.sprite(480,490,"player").setScale(.66).setOrigin(.5,.88).setDepth(490).setCollideWorldBounds(true);
this.player.body.setSize(20,22);this.player.body.setOffset(14,30);this.player.setDrag(1000,1000);
this.obstacles=this.physics.add.staticGroup();
const block=(x,y,w,h)=>{let r=this.add.rectangle(x,y,w,h,0,0).setVisible(false);this.physics.add.existing(r,true);this.obstacles.add(r)};
block(480,60,900,30);block(170,135,260,90);block(778,135,260,90);block(360,178,75,105);block(870,180,85,115);block(480,374,240,72);block(165,350,125,105);block(812,365,140,90);block(75,470,80,70);block(885,470,80,70);
this.physics.add.collider(this.player,this.obstacles);this.nearest=null;this.dialogueLines=null;this.dialogueIndex=0;this.setupInput()
}
setupInput(){
this.cursors=this.input.keyboard.createCursorKeys();this.keys=this.input.keyboard.addKeys({up:"Z",down:"S",left:"Q",right:"D"});
this.input.keyboard.on("keydown-E",()=>this.interact());this.input.keyboard.on("keydown-ENTER",()=>this.nextDialogue());this.input.keyboard.on("keydown-SPACE",()=>this.nextDialogue());
this.touch={x:0,y:0};const joy=document.getElementById("joystick"),knob=document.getElementById("joystick-knob");let pid=null;
const move=e=>{const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max}this.touch.x=dx/max;this.touch.y=dy/max;knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`};
const reset=()=>{pid=null;this.touch.x=0;this.touch.y=0;knob.style.transform="translate(-50%,-50%)"};joy.addEventListener("pointerdown",e=>{e.preventDefault();pid=e.pointerId;joy.setPointerCapture(pid);move(e)});joy.addEventListener("pointermove",e=>{if(e.pointerId===pid)move(e)});joy.addEventListener("pointerup",reset);joy.addEventListener("pointercancel",reset);
document.getElementById("action-button").addEventListener("pointerdown",e=>{e.preventDefault();this.interact()});document.getElementById("dialogue").addEventListener("pointerdown",e=>{e.preventDefault();this.nextDialogue()})
}
update(){
if(this.dialogueLines){this.player.setVelocity(0,0);return}let x=0,y=0;if(this.cursors.left.isDown||this.keys.left.isDown)x--;if(this.cursors.right.isDown||this.keys.right.isDown)x++;if(this.cursors.up.isDown||this.keys.up.isDown)y--;if(this.cursors.down.isDown||this.keys.down.isDown)y++;if(Math.abs(this.touch.x)>.12||Math.abs(this.touch.y)>.12){x+=this.touch.x;y+=this.touch.y}let l=Math.hypot(x,y);if(l>1){x/=l;y/=l}this.player.setVelocity(x*145,y*145);this.player.setDepth(this.player.y+10);this.cecile.setDepth(this.cecile.y);this.thomas.setDepth(this.thomas.y);this.cat.setDepth(this.cat.y);this.updateInteraction()
}
updateInteraction(){
const ts=[{o:this.cecile,id:"cecile",r:70},{o:this.thomas,id:"thomas",r:70},{o:this.cat,id:"cat",r:60},{o:{x:480,y:345},id:"book",r:65}];let b=null,bd=1e9;for(const t of ts){let q=Math.hypot(this.player.x-t.o.x,this.player.y-t.o.y);if(q<t.r&&q<bd){b=t;bd=q}}this.nearest=b;const h=document.getElementById("interaction-hint");if(b){h.classList.remove("hidden");h.textContent=b.id==="book"?"E — Examiner":"E — Interagir"}else h.classList.add("hidden")
}
interact(){
if(this.dialogueLines){this.nextDialogue();return}if(!this.nearest)return;
if(this.nearest.id==="cecile")this.showDialogue([["Cécile","Bonjour."],["Cécile","Je lis un peu avant de repartir."],["Cécile","Tu connais Krasznahorkai ?"]]);
if(this.nearest.id==="thomas")this.showDialogue([["Thomas","Ah. Enfin quelqu'un."],["Thomas","Tu sais comment fonctionne ce mécanisme ?"],["Voyageur","Non."],["Thomas","Moi non plus."],["Thomas","Mais ça devrait fonctionner."]]);
if(this.nearest.id==="cat")this.showDialogue([["Ti Chat","Miaou."]]);
if(this.nearest.id==="book")this.showDialogue([["Livre","Les pages sont couvertes d'une écriture ancienne."],["Livre","Certaines phrases semblent avoir été effacées."],["Livre","Une seule ligne reste parfaitement lisible."],["Livre","« Toute expédition commence avant même que ses voyageurs sachent où ils vont. »"]])
}
showDialogue(l){this.dialogueLines=l;this.dialogueIndex=0;this.renderDialogue()}
renderDialogue(){let[n,t]=this.dialogueLines[this.dialogueIndex];document.getElementById("dialogue-name").textContent=n;document.getElementById("dialogue-text").textContent=t;document.getElementById("dialogue").classList.remove("hidden")}
nextDialogue(){if(!this.dialogueLines)return;this.dialogueIndex++;if(this.dialogueIndex>=this.dialogueLines.length){this.dialogueLines=null;document.getElementById("dialogue").classList.add("hidden")}else this.renderDialogue()}
}
new Phaser.Game({type:Phaser.AUTO,parent:"game-root",width:GAME_W,height:GAME_H,backgroundColor:"#17120f",pixelArt:true,antialias:false,physics:{default:"arcade",arcade:{gravity:{y:0},debug:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:GAME_W,height:GAME_H},scene:[LibraryScene]});
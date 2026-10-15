'use strict';
const L=require('./ui-layout'),T=require('./theme').TOKENS;
const assets=require('./shared-ui-assets');
Object.assign(require('./asset-catalog'),assets.catalog);
function install(App){
 const p=App.prototype,base={rect:p.rect,header:p.header,render:p.render,paper:p.paper};
 p.sharedSkin=function(id,bounds){
  const asset=assets.catalog[id],url=this.assetFiles&&this.assetFiles[id];
  if(!asset||!url||!this.platform.createImage)return false;
  this.assetImages=this.assetImages||{};let entry=this.assetImages[url];
  if(!entry){const image=this.platform.createImage();entry=this.assetImages[url]={image,state:'loading'};image.onload=()=>{entry.state='ready';};image.onerror=()=>{entry.state='error';};image.src=url;}
  if(entry.state!=='ready')return false;
  const v=asset.visible_bounds;
  this.ctx.drawImage(entry.image,v.x,v.y,v.width,v.height,bounds.x,bounds.y,bounds.width,bounds.height);
  return true;
 };
 p.rect=function(x,y,w,h,fill,r){
  base.rect.call(this,x,y,w,h,fill,r);
  if(w<60||h<28||h>56)return;
  const key={ [T.yellow]:'UI-BUTTON-YELLOW',[T.blue]:'UI-BUTTON-BLUE',[T.coral]:'UI-BUTTON-CORAL',[T.mint]:'UI-BUTTON-MINT' }[fill];
  if(key)this.sharedSkin(key,{x,y,width:w,height:h});
 };
 p.header=function(title,sub){
  this.sharedSkin('UI-TITLE-CLOUD',L.header.cloud);
  const a=L.header.brand,b=L.header.title,c=L.header.subtitle;
  this.text('PLAY A WHILE  /  玩一会儿',a.x,a.y,a.size,T.muted,'left',true);
  this.text(title,b.x,b.y,b.size,T.ink,'left',true);
  this.stroke([[25,109],[98,112],[135,108]],T.yellow,5);
  if(sub)this.text(sub,c.x,c.y,c.size,T.muted);
 };

 p.modeTabs=function(){['个人','对战','派对'].forEach((name,i)=>{const b=L.modeTabs[i];this.button(name,b.x,b.y,b.width,b.height,()=>{this.mode=name;},this.mode===name?T.yellow:T.white,T.ink);});};
 p.nav=function(){const b=L.nav;this.rect(b.x,b.y,b.width,b.height,T.white,18);this.sharedSkin('UI-NAV',b);['玩法','个人'].forEach((name,i)=>{const a=L.navTabs[i];this.button(name,a.x,a.y,a.width,a.height,()=>{this.tab=name;this.go('home');},this.tab===name?T.yellow:T.white,T.ink);this.sharedSkin(i?'UI-ICON-PROFILE':'UI-ICON-PLAY',{x:a.x+17,y:a.y+8,width:26,height:26});});};

 p.paper=function(){if(!this.assetImages||!this.assetFiles||!this.assetImages[this.assetFiles['UI-PAPER']]||this.assetImages[this.assetFiles['UI-PAPER']].state!=='ready')base.paper.call(this);};
 p.render=function(){
  const c=this.ctx,fill=c.fillRect;let painted=false;
  c.fillRect=(...args)=>{
   fill.apply(c,args);
   if(painted||args[0]!==0||args[1]!==0||args[2]!==this.width||args[3]!==this.height)return;
   painted=true;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);
   this.sharedSkin('UI-PAPER',L.viewport);
   ['UI-DECOR-TL','UI-DECOR-TR','UI-DECOR-BL','UI-DECOR-BR'].forEach((id,i)=>this.sharedSkin(id,L.decor[i]));c.restore();
  };
  try{return base.render.call(this);}finally{c.fillRect=fill;}
 };
}
module.exports={install,LAYOUT:L};

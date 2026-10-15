'use strict';
const {levels}=require('./fruit-assets');
function install(App){
 App.prototype.drawFruitSprite=function(level,cx,cy,radius){
  const sprite=levels[level],url=sprite&&this.assetFiles&&this.assetFiles[sprite.id];
  if(!url||!this.platform.createImage)return false;
  this.assetImages=this.assetImages||{};let entry=this.assetImages[url];
  if(!entry){const image=this.platform.createImage();entry=this.assetImages[url]={image,state:'loading'};image.onload=()=>{entry.state='ready';};image.onerror=()=>{entry.state='error';};image.src=url;}
  if(entry.state!=='ready')return false;
  const s=radius/sprite.body.r;
  this.ctx.drawImage(entry.image,cx-sprite.body.x*s,cy-sprite.body.y*s,sprite.pixel_size[0]*s,sprite.pixel_size[1]*s);
  return true;
 };
}
module.exports={install};

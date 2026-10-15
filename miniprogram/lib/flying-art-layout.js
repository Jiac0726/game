'use strict';
// Rendering calibration only. Game progress and server path IDs stay unchanged.
const paths = require('./flying-paths');
const source = { width: 851, height: 946 };
const oldX = [78,174,256,357,456,541,625,709,794,895,995,1078,1172];
const newX = [47,111,169,239,310,367,426,486,545,613,682,741,806];
const oldY = [83,183,263,354,450,532,619,704,785,885,970,1050,1144];
const newY = [98,168,224,300,369,430,490,549,608,680,750,806,874];
function interpolate(value, a, b) {
  let i=0; while(i<a.length-2 && value>a[i+1]) i++;
  return b[i]+(value-a[i])/(a[i+1]-a[i])*(b[i+1]-b[i]);
}
const home = {
  Y: [[111,490],[169,490],[239,490],[310,490],[367,490],[426,490]],
  B: [[426,168],[426,224],[426,284],[426,346],[426,400],[426,490]],
  R: [[426,806],[426,750],[426,699],[426,647],[426,591],[426,490]],
  G: [[741,490],[682,490],[631,490],[545,490],[486,490],[426,490]]
};
const airports = {Y:[0,61], B:[657,61], R:[0,724], G:[657,724]};
const homesByPoint = {};
for (const color of Object.keys(paths.colors)) paths.colors[color].home.forEach((p,i)=>{
  homesByPoint[p.x+','+p.y]=home[color][i];
});
function sourcePoint(point) {
  const m = /^FG-AIRPORT-([YBRG])-(\d)$/.exec(point.id||'');
  if(m){const origin=airports[m[1]], i=Number(m[2]);return {x:origin[0]+55+(i%2)*80,y:origin[1]+49+Math.floor(i/2)*80};}
  const h=homesByPoint[point.x+','+point.y];
  if(h)return {x:h[0],y:h[1]};
  return {x:interpolate(point.x,oldX,newX),y:interpolate(point.y,oldY,newY)};
}
function project(point, bounds) {
  const p=sourcePoint(point);
  return {x:bounds.x+p.x/source.width*bounds.width,y:bounds.y+p.y/source.height*bounds.height};
}
function airportBounds(color,bounds) {
  const p=airports[color];return {x:bounds.x+p[0]/source.width*bounds.width,y:bounds.y+p[1]/source.height*bounds.height,width:194/source.width*bounds.width,height:(color==='Y'||color==='B'?182:202)/source.height*bounds.height};
}
module.exports={source,sourcePoint,project,airportBounds};

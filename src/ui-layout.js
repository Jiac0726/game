'use strict';
// Original HTML preview coordinate system. Both runtimes use these rectangles.
const rect=(x,y,width,height)=>Object.freeze({x,y,width,height});
module.exports=Object.freeze({
 viewport:rect(0,0,375,812),
 header:Object.freeze({brand:{x:24,y:45,size:10},title:{x:24,y:88,size:29},subtitle:{x:24,y:134,size:12},cloud:rect(15,55,257,56)}),
 flying:Object.freeze({board:rect(24,206,327,327),dice:rect(41,563,60,60),primary:rect(132,580,219,48),choices:Object.freeze([rect(24,645,77,44),rect(107,645,77,44),rect(190,645,77,44),rect(273,645,77,44)])}),
 back:rect(274,27,77,44),
 modeTabs:Object.freeze([rect(24,161,103,43),rect(136,161,103,43),rect(248,161,103,43)]),
 nav:rect(16,734,343,62),navTabs:Object.freeze([rect(25,744,155,42),rect(195,744,155,42)]),
 toast:rect(24,98,327,39),
 modal:rect(38,274,299,235),modalActions:Object.freeze([rect(60,389,255,44),rect(60,448,255,44)]),pauseActions:Object.freeze([rect(60,361,255,44),rect(60,417,255,44),rect(60,476,255,44)]),
 button:Object.freeze({radius:12,labelSize:15}),card:Object.freeze({radius:13,border:1.7}),
 decor:Object.freeze([rect(0,0,125,164),rect(289,0,86,164),rect(0,618,149,184),rect(226,618,149,184)])
});

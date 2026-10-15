'use strict';
const {FlyingChessGame}=require('./src/game-app');
const wxApi=typeof wx==='undefined'?null:wx;
if(wxApi){
 const app=new FlyingChessGame(wxApi);
 app.boot();
 module.exports=app;
}else module.exports={FlyingChessGame};

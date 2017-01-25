var sinaGiboParser = require('./index')

var url = 'http://duiyi.sina.com.cn/gibo/new_gibo.asp?cur_page=1'

sinaGiboParser.getTitleList(url, function(err, titleObjList){
	console.log(err)
	console.log('getTitleList 取得此頁所有的棋譜連結清單')
	console.log(titleObjList)
})

url = 'http://duiyi.sina.com.cn/cgibo/20171/ty31b2-170116gl.sgf'

sinaGiboParser.getPageChess(url, function(err, contentObj){
	console.log(err)
	console.log('getTitleList 取得新浪棋譜連結的內容')
	console.log(contentObj)
})

sinaGiboParser.getAllPagesList(function(err, pageList){
	console.log(err)
	console.log('getAllPagesList 取得新浪棋譜的所有頁面清單')
	console.log(pageList)
})

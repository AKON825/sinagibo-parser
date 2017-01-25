module.exports = SinaGiboParser

var path = require('path')
var async = require('async')
var request = require('request')
var cheerio = require('cheerio')
var iconv = require('iconv-lite')
var moment = require('moment')

var sinagoUrl = 'http://duiyi.sina.com.cn/gibo/new_gibo.asp'

// 新浪內容網址
//http://duiyi.sina.com.cn/gibo/new_gibo.asp?cur_page=1

function SinaGiboParser () {
  if (!(this instanceof SinaGiboParser)) {
    return new SinaGiboParser()
  }

  /**
   * 取得新浪棋譜的所有頁面list
   *
   * @param {string} pageUrl
   * @param {Function} cb
   * @returns {object}
   */
  this.getAllPagesList = function (cb) {
    var pageList = []
    var nextNum = 0

    var pageNum = '0'
    // var pageNum = '710'
    //var pageNum = '720'
    // var pageNum = '730'
    var continueErrCount = 0

    var hasNextRound = true
    return async.whilst(
      function() { return hasNextRound == true; },
      function(asyncCb) {
        return find10PageList(pageNum, function(err, nextRoundNum){
          if(err) {
            pageNum = pageNum + 10

            // 出錯計數器+1
            continueErrCount = continueErrCount + 1

            return nextRound()
          } else {
            // 沒出錯把err技術歸零
            continueErrCount = 0
          }

          if (nextRoundNum == null){
            hasNextRound = false
          }

          pageNum = nextRoundNum

          return nextRound()

          function nextRound() {
            if(continueErrCount >= 5) {
              return asyncCb(new Error('截取頁面清單錯誤超過次數'))
            }
            // 一秒後再操作下一輪
            return setTimeout(function() {
              return asyncCb()
            }, 1000);
          }
        })

      },
      function (err) {
        if(err) {
          return cb(err)
        }

        return cb(null, pageList)
      }
    )

    function find10PageList(pageNum, cb) {
      return request({
        url: sinagoUrl + '?cur_page=' + pageNum,
        //禁止使用預設編碼
        encoding: null
      }, function (error, response, body) {
        if (error) {
          return cb(error)
        }

        if(response.statusCode != 200) {
          return cb(new Error('頁面截取失敗'))
        }

        if (!error && response.statusCode == 200) {
          var body = iconv.decode(body, 'GBK');
          // 簡轉繁?
          var page = 0;
          var $ = cheerio.load(body)

          var nowPage = $('td.body_text1').eq(1).children('b').text()
          nowPage = nowPage.replace(/[\[\]]/g, '')
          var allFont = $('td.body_text1').eq(1).children('font')
          var lastFont = $('td.body_text1').eq(1).children('font').last()
          var firstFont = $('td.body_text1').eq(1).children('font').first()
          lastFont = lastFont.text().replace(/[\[\]]/g, '')
          firstFont = firstFont.text().replace(/[\[\]]/g, '')

          // var a = firstFont.search(/[^0-9]/g)
          // //var a = lastFont.search(/[^0-9]/g)
          // logger.info(a)
          // 跳過可能會遇到的'往前'字串
          if(firstFont.search(/[^0-9]/g) !== -1) {
            // 重新抓位子和處理字串
            firstFont = $('td.body_text1').eq(1).children('font').eq(0)
            firstFont = firstFont.text().replace(/[\[\]]/g, '')
          }

          if(lastFont.search(/[0-9]/g) !== -1) {

          }

          var firstFontNum = parseInt(firstFont, 10);
          var lastFontNum = parseInt(lastFont, 10);
          var nowPageNum = parseInt(nowPage, 10)

          // 如果沒有當前頁數和最後頁數
          if(isNaN(lastFontNum) || isNaN(nowPageNum)) {
            return cb(new Error('解析不到頁數'))
          }

          var stopNum = 0
          var stopNumFinded = false

          allFont.each(function(index){
            var font = allFont.eq(index)
            var color = font.attr('color')

            if(color == '#DDDDDD' && !stopNumFinded) {
              stopNum = font.text().replace(/[\[\]]/g, '')
              stopNum = parseInt(stopNum, 10);

              stopNumFinded = true
            }
          })

          // 如果有停用的頁數
          if(stopNum !== 0){
            lastFontNum = stopNum - 1
          }

          // 第幾頁的cur_page實際連結會-1
          for(var i = nowPageNum - 1; i<lastFontNum; i++) {
            pageList.push(sinagoUrl + '?cur_page=' + i)
          }

          var nextRoundNum = null

          if(stopNum === 0) {
            nextRoundNum = lastFontNum
          }

          return cb(null, nextRoundNum)
        }
      })
    }


  }

  /**
   * 抓一頁標題清單頁中的標題和連結
   *
   * @param {string} pageUrl
   * @param {Function} cb
   * @returns {object}
   */
  this.getTitleList = function (pageUrl, cb) {
    return request({
      url: pageUrl,
      //禁止使用預設編碼
      encoding: null
    }, function (error, response, body) {
      if (error) {
        return cb(error.message)
      }

      if (response.statusCode != 200) {
        return cb('網頁失效')
      }

      var body = iconv.decode(body, 'GBK');
      var $ = cheerio.load(body)

      var titleObjList = []
      var trList = $('tr.body_text1')

      for (var i = 1; i < trList.length; i++) {
        var allTd = trList.eq(i).children('td')
        var date = allTd.eq(0).text()
        date = moment(new Date(date)).format('YYYY-MM-DD')
        var blackName = allTd.eq(1).text()
        var whiteName = allTd.eq(2).text()
        var title = allTd.eq(3).text()
        var chessResult = allTd.eq(4).text()
        var href = allTd.eq(1).children('a').attr('href')
        href = href.replace(/.*\(\'(.*)\'\);/g, '$1')


        var titleObj = {
          title: title,
          href: href,
          date: date,
          chess_result: chessResult,
          black_name : blackName,
          white_name: whiteName,
        }

        titleObjList.push(titleObj)
      }

      return cb(null, titleObjList)
    })
  }

  /**
   * 抓一頁的棋譜
   *
   * @param {string} pageUrl
   * @param {Function} cb
   * @returns {object}
   */
  this.getPageChess = function (pageUrl, cb) {
    var sinaGoViewUrl = 'http://duiyi.sina.com.cn/gibo_new/giboviewer/giboviewer.asp?gibo='
    return request({
      url: sinaGoViewUrl + pageUrl,
      //禁止使用預設編碼
      //encoding: null
    }, function (error, response, body) {
      if (error) {
        return cb(error)
      }

      if(response.statusCode != 200) {
        return cb(error)
      }

      //var body = iconv.decode(body, 'big5');
      //var body = iconv.decode(body, 'GBK');
      // var page = 0;
      var $ = cheerio.load(body)
      var content = $('#gibo_txt').val()

      var pbIndex = content.search(/PB\[/g)
      var pwIndex = content.search(/PW\[/g)
      var pb = content.replace(/[^]*PB\[(.*)\][^]*/g, '$1')
      var pw = content.replace(/[^]*PW\[(.*)\][^]*/g, '$1')
      var br = content.replace(/[^]*BR\[(.*)\][^]*/g, '$1')
      var wr = content.replace(/[^]*WR\[(.*)\][^]*/g, '$1')

      // 判斷是否正確sgf
      if(pbIndex == -1 && pwIndex == -1) {
        content = null
        br = null
        wr = null
      }

      var contentObj = {
        content: content,
        url: pageUrl,
        black_level: br,
        white_level: wr,
        black_name: pb,
        white_name: pw
      }

      return cb(null, contentObj)
    })
  }

}

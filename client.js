;(function() {

  /** 
   * abbrevations:
   *   i = increment
   *   d = decrement
   *   t = timing
   *   g = gauge
   */

  var statsc = {
    prefix: ''
  }; 
  var addr;

  /** 
   * Set the statsc server address.
   *
   * Use this if the server isnt listening on `http://localhost:8126`
   * or perhaps if you are using a custom `send` method.
   * 
   * @param  {String} _addr
   */
  statsc.connect = function(_addr) {
    addr = _addr || 'http://localhost:8127/';
  };  

  /** 
   * Increment the counter at `stat` by one.
   * 
   * @param  {string} stat
   * @param  {number} sampleRate
   * @param  {array} tags
   */
  statsc.increment = function(stat, sampleRate, tags) {
    statsc.send(['c', stat, 1, sampleRate, tags]);
  };  

  /** 
   * Decrement the counter at `stat` by one.
   * 
   * @param  {string} stat
   * @param  {number} sampleRate
   * @param  {array} tags
   */
  statsc.decrement = function(stat, sampleRate, tags) {
    statsc.send(['c', stat, -1, sampleRate, tags]);
  };  

  /** 
   * Set the gauge at `stat` to `value`.
   * 
   * @param  {string} stat
   * @param  {number} value
   * @param  {number} sampleRate
   * @param  {array} tags
   */
  statsc.gauge = function(stat, value, sampleRate, tags) {
    statsc.send(['g', stat, value, sampleRate, tags]);
  };  

  /** 
   * Log `time` to `stat`.
   *
   * `time` can either be
   *   - a number in milliseconds
   *   - a Date object, created at the timer's start
   *   - a synchronous function to be timed
   * 
   * @param  {string}               stat
   * @param  {number|Date|function} time
   * @param  {number}               sampleRate
   * @param  {array} tags
   */
  statsc.timing = function(stat, time, sampleRate, tags) {
    if ('number' == typeof time) {
      return statsc.send(['ms', stat, time, sampleRate, tags]);
    }   
    if (time instanceof Date) {
      return statsc.send(['ms', stat, fromNow(time), sampleRate, tags]);
    }   
    if ('function' == typeof time) {
      var start = new Date();
      time();
      statsc.send(['ms', stat, fromNow(start), sampleRate, tags]);
    }   
  };  

  /** 
   * Timer utility in functional style.
   * 
   * Returns a function you can call when you want to mark your timer as
   * resolved.
   * 
   * @param  {string}   stat
   * @param  {number}   sampleRate
   * @param  {array} tags
   * @return {function}
   */
  statsc.timer = function(stat, sampleRate, tags) {
    var start = new Date().getTime();

    return function() {
      statsc.send(['ms', stat, fromNow(start), sampleRate, tags]);
    }   
  };  

  /** 
   * Standard implementation of a `send` method.
   *
   * Overwrite this if you want to use websockets or jsonp or whatever.
   *
   * @param {array} data
   */
  statsc.send = (function() {
    var queue = []; 
    var head = document.getElementsByTagName('head')[0];

    setInterval(function() {
      if (queue.length > 0) {
        // clear null values
        for (var i = 0; i < queue.length; i++) {
          for (var j = 0; j < queue[i].length; j++) {
            if (queue[i][j] == null) queue[i].splice(j, 1);
          }
        }

        if (addr) {
          var tag = document.createElement('script');
          tag.src = addr + '?' + queue.map(pack).join(';').replace(/#/g, '%23');
          tag.onload = function () {
            head.removeChild(tag);
          }
          head.appendChild(tag);
        }

        queue = [];
      }
    }, 5000);

    return function(data) { queue.push(data); }
    })();

  /**
   * Calculate the difference between `now` and the given Date object.
   * 
   * @param  {object} time
   * @return {number} difference in milliseconds
   */
  function fromNow(date) {
    return new Date() - date;
  }

  function pack(stat) {
    var type = stat[0],
        key = stat[1],
        value = stat[2] || 1,
        sampleRate = stat[3],
        tags = stat[4],
        str = statsc.prefix + key + ':' + value + '|' + type

    if (sampleRate instanceof Array) {
      tags = sampleRate
      sampleRate = undefined
    }

    if (sampleRate) {
      str += '|@' + sampleRate
    }
    if (tags) {
      str += '|#' + tags.join(',')
    }

    return str
  }

  /**
   * Expose `statsc` to the world
   */
  if (typeof require == 'function' && typeof module != 'undefined') {
    module.exports = statsc;
  }
  if (typeof window == 'object') {
    window.statsc = statsc;
  }

})();

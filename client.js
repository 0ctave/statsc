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
   * Add the value `value` to a set `stat`.
   *
   * @param  {string} stat
   * @param  {number} value
   * @param  {number} sampleRate
   * @param  {array} tags
   */
  statsc.set = function(stat, value, sampleRate, tags) {
    statsc.send(['s', stat, value, sampleRate, tags]);
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
    var fn = function() {
      statsc.send(['ms', stat, fromNow(fn.start), sampleRate, tags]);
    }
    fn.start = new Date().getTime();

    return fn;
  };

  /**
   * Standard implementation of a `send` method.
   *
   * Overwrite this if you want to use websockets or jsonp or whatever.
   *
   * @param {array} data
   */
  statsc.send = (function () {
      var queue = [];
      var head = document.getElementsByTagName('head')[0];
      var maxQueueLength = 300;
      var maxJsonLength = 1000;

      setInterval(function () {
          if (queue.length > 0) {
              var localQueue = queue;
              queue = [];
              // clear null values
              for (var i = 0; i < localQueue.length; i++) {
                  for (var j = 0; j < localQueue[i].length; j++) {
                      if (localQueue[i][j] == null) localQueue[i].splice(j, 1);
                  }
              }
              var i = 0;
              while (addr && localQueue.length > 0 || i == 10) {
                  var buffer = localQueue.slice(0, maxQueueLength);
                  var str = JSON.stringify(compressAsObject(buffer));
                  if (str.length <= maxJsonLength) {
                      var tag = document.createElement('script');
                      tag.src = addr + '?json=' + str;
                      tag.onload = function () {
                          head.removeChild(tag);
                      };
                      head.appendChild(tag);
                      localQueue.splice(0, maxQueueLength);
                  } else {
                      i++;
                      maxQueueLength = Math.floor(maxQueueLength / 1.5);
                  }
              }
          }
      }, 5000);

      return function (data) {
          queue.push(data);
      }
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

    function compressAsObject(queue) {
        var result = {};
        var counts = {};
        queue.forEach(function(stat){
            var type = stat[0],
                key = stat[1],
                value = stat[2] || 1,
                sampleRate = stat[3],
                tags = stat[4];
            if (type == 'c') {
                var prefixedKey = (statsc.prefix + key);
                if (counts[prefixedKey] == undefined) {
                    counts[prefixedKey] = {};
                }
                var suffix = '_';
                if (sampleRate) {
                    suffix += '|@' + sampleRate
                }
                if (tags) {
                    suffix += '|#' + tags.join(',')
                }

                if (counts[prefixedKey][suffix] == undefined) {
                    counts[prefixedKey][suffix] = 0;
                }
                counts[prefixedKey][suffix] += value;
            }
        });
        queue.forEach(function(stat){
            var type = stat[0],
                key = stat[1],
                value = stat[2] || 1,
                sampleRate = stat[3],
                tags = stat[4];
            if (type != 'c') {
                if (result[type] == undefined) {
                    result[type] = {};
                }
                var prefixed = (statsc.prefix + key);
                if (result[type][prefixed] == undefined) {
                    result[type][prefixed] = [];
                }
                var val = value;
                if (sampleRate) {
                    val += '|@' + sampleRate
                }
                if (tags) {
                    val += '|#' + tags.join(',')
                }
                result[type][prefixed].push(val);
            }
        });

        for (var key in counts) {
            if (!counts.hasOwnProperty(key)) continue;

            for(var suffix in counts[key]) {
                if (!counts[key].hasOwnProperty(suffix)) continue;

                if (result['c'] == undefined) {
                    result['c'] = {};
                }
                if (result['c'][key] == undefined) {
                    result['c'][key] = [];
                }
                result['c'][key].push(counts[key][suffix] + suffix.slice(1));
            }
        }
        return result;
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

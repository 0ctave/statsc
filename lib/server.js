/**
 * Module dependencies
 */

var lynx = require('lynx')

/**
 * StatsC server
 * @type {Object}
 */

var statsc = {
  statsd: new lynx('localhost', 8125)
};

/**
 * HTTP server handle
 * 
 * Pass to http(s).createServer() in order to handle the standard script-tag
 * transport.
 *
 * @throws {String} If invalid data is given
 * @param  {object} req
 * @param  {object} res
 */

statsc.http = function(req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'});

  // overwrite res.end for json serving
  var end = res.end.bind(res);
  res.end = function (data) {
    return end(JSON.stringify(data));
  }

  console.log('req', req.url)

  if (req.method != 'GET') return res.end('Only GET supported');

  var url = decodeURIComponent(req.url).replace(/\//g, '');
  if (url == 'favicon.ico') return res.end();
  if (url[0] != '?') return res.end('File serving not supported');

  var ops = url.substr(1).split(';')
  // var ops = url.substr(1).replace(';', "\n")

  for (var i = 0, len = ops.length; i < len; i++) {
    try {
      statsc.receive(ops[i]);
    } catch(err) {
      return res.end(err.toString());
    }
  }

  res.end('OK');
}

/**
 * Logs `op` to StatsD.
 *
 * Format for `op`:
 *   op = [method, stat, (value/sampleRate), (sampleRate)]
 *
 * @throws {String} If `op` isn't valid
 * @param  {array}  op
 */

statsc.receive = function(op) {
  statsc.statsd.write(op)
}

/**
 * Configure the address at which StatsD runs
 * 
 * @param {string} address `host:port`
 */

statsc.setAddress = function(address, port) {
  statsc.statsd = new lynx(address, port)
}

/**
 * Expose StatsC to the world
 */

module.exports = statsc;

var db = require('../db.sqlite'),
    express = require('express')
    ;

var temps = express.Router();

temps.get('/current', function(req, res, next) {
    db.getLastHourOfTemps().then(function (result) {
        // TODO: should use last modified of record
        res.setHeader('Last-Modified', (new Date()).toUTCString());

        res.send(result);
    });
});

module.exports.temps = temps;
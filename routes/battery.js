var db = require('../db.sqlite'),
    express = require('express')
    ;

var battery = express.Router();

battery.get('/', function(req, res, next) {
    db.getBatteryStatus().then(function (evt) {
        res.send(evt);
    });
});

module.exports.battery = battery;
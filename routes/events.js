var db = require('../db.sqlite'),
    express = require('express')
    ;

var events = express.Router();

events.post('/start', function(req, res, next) {
    db.startEvent(req.body.title).then(function (result) {
        res.send(result);
    });
});

events.post('/stop', function(req, res, next) {
    db.stopEvent(req.body.id).then(function (result) {
        res.send(result);
    });
});

module.exports.events = events;
var db = require('../db.sqlite'),
    express = require('express')
    ;

var event = express.Router();

event.get('/', function(req, res, next) {
    db.getAllEvents().then(function (result) {
        res.send(result);
    });
});

event.param('eventId', function (req, res, next, eventId) {
    db.isEventExisting(eventId).then(function (exists) {
        if (!exists)
        {
            return next(res.sendStatus(404));
        }
        req.eventId = eventId;
        next()
    });
});

event.get('/:eventId', function (req, res) {
    // get event data
    // get temps for event
    // get comments for event
    var eventData = db.getEvent(req.eventId);
    var temps = function (evt) {
        return db.getEventTemps(evt);
    };
    var comments = function (evt) {
        return db.getEventComments(evt);
    };

    eventData.then(function (evt) {
        return temps(evt);
    }).then(function (evt) {
        return comments(evt);
    }).then(function (evt) {
        res.send(evt);
    });
});

event.post('/:eventId/comment', function (req, res) {
    db.setEventComment(req.eventId, req.body.comment).then(function (result) {
        res.send(result);
    });
});

module.exports.event = event;
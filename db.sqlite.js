var  fs = require('fs')
    ,sqlite3 = require('sqlite3').verbose()
    ,extend = require('extend')
;

/////
// sqlite init
/////

var db = new sqlite3.Database('maverickTemps.db'); //new sqlite3.Database(':memory:');
(function () {
    var exists = fs.existsSync('maverickTemps.db');
    if (!exists) {
        db.serialize(function () {
            db.run("CREATE TABLE schemaVersion (version INTEGER)");
            db.run("CREATE TABLE batteryStatus (time TEXT, percent INTEGER)");
            db.run("CREATE TABLE temps (probe INTEGER, time TEXT, temp INTEGER)");

            db.run("CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, startTime TEXT, stopTime TEXT, title TEXT)");
            db.run("CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, eventId INTEGER, time TEXT, comment TEXT)");

            var stmt = db.prepare("INSERT INTO schemaVersion VALUES (?)");
            stmt.run(1);
            stmt.finalize();
        });
    } else {
        // check schema version
        db.get('SELECT version FROM schemaVersion', function (err, row) {
            if (undefined != err) {
                console.log("*** Error checking schema - delete maverickTemps.db and try again?");
                console.log(err);
                process.exit();
            }
            if (row.version != 1) {
                console.log('bad schema version');
                process.exit();
            }
        });
    }
})();

module.exports = {
    close: function () {
        db.close();
    },

    getBatteryStatus: function () {
        return new Promise(function (resolve) {
            db.serialize(function () {
                db.each("SELECT time, percent FROM batteryStatus ORDER BY time LIMIT 1", function (err, row) {
                    resolve({
                        time: row.time,
                        percent: row.percent
                    });
                });
            });
        });
    },
    setBatteryStatus: function (batteryPercent) {
        db.serialize(function () {
            var ts = new Date().toISOString();
            var stmt = db.prepare("INSERT INTO batteryStatus VALUES (?, ?)");
            stmt.run(ts, batteryPercent);
            stmt.finalize();
        });
    },

    getLastHourOfTemps: function() {
        return new Promise(function (resolve) {
            var temps = [];
            db.serialize(function () {
                var lastHour = new Date();
                lastHour.setHours(lastHour.getHours() - 1);
                db.each("SELECT probe, time, temp FROM temps WHERE datetime(time) > datetime(?) ORDER BY time", lastHour.toISOString(), function (err, row) {
                    temps.push({
                        probe: row.probe,
                        time: row.time,
                        temp: row.temp
                    });
                }, function () {
                    // All done fetching records, render response
                    resolve({
                        temps: temps
                    });
                });
            });
        });
    },
    setProbeTemp: function(probeId, ts, probeTemp) {
        db.serialize(function () {
            var stmt = db.prepare("INSERT INTO temps VALUES (?, ?, ?)");
            stmt.run(probeId, ts, probeTemp);
            stmt.finalize();
        });
    },

    getAllEvents: function() {
        return new Promise(function (resolve) {
            var events = [];
            db.serialize(function () {
                db.each("SELECT id, title, startTime, stopTime FROM events ORDER BY id", function (err, row) {
                    events.push({
                        id: row.id,
                        title: row.title,
                        startTime: row.startTime,
                        stopTime: row.stopTime
                    });
                }, function () {
                    resolve({
                        events: events
                    });
                });
            });
        });
    },
    isEventExisting: function(id) {
        return new Promise(function(resolve) {
            db.get('select id from events where id=?', id, function (err, row) {
                if (err || !row){
                    resolve(false);
                }
                resolve(true);
            });
        });
    },
    getEvent: function(id) {
        return new Promise(function (resolve) {
            db.get('select id, title, startTime, stopTime from events where id=?', id, function (err, row) {
                resolve(row);
            });
        });
    },
    getEventTemps: function(event) {
        return new Promise(function (resolve) {
            var tempArr = [];
            db.each('select probe, time, temp from temps where time between ? and ?', event.startTime, event.stopTime, function (err, row) {
                tempArr.push(row);
            }, function () {
                resolve(extend(event, {
                    temps: tempArr
                }));
            })
        });
    },
    getEventComments: function(event) {
        return new Promise(function (resolve) {
            var tempArr = [];
            db.each('select id, time, comment from comments where eventId=?', event.id, function (err, row) {
                tempArr.push(row);
            }, function () {
                resolve(extend(event, {
                    comments: tempArr
                }));
            })
        });
    },
    setEventComment: function(eventId, comment) {
        return new Promise(function (resolve) {
            db.serialize(function () {
                var stmt = db.prepare("INSERT INTO comments (eventId, time, comment) VALUES (?, ?, ?)");
                stmt.run(eventId, (new Date()).toISOString(), comment);
                stmt.finalize();

                db.get('select seq from sqlite_sequence where name="comments"', function (err, row) {
                    resolve({
                        id: row.seq
                    });
                });
            });
        });
    },
    startEvent: function(name) {
        return new Promise(function (resolve) {
            db.serialize(function () {
                var stmt = db.prepare("INSERT INTO events (startTime, title) VALUES (?, ?)");
                stmt.run((new Date()).toISOString(), name);
                stmt.finalize();

                db.get('select seq from sqlite_sequence where name="events"', function (err, row) {
                    resolve({
                        id: row.seq
                    });
                });
            });
        });
    },
    stopEvent: function(id) {
        return new Promise(function (resolve) {
            var stmt = db.prepare("UPDATE events SET stopTime = ? WHERE id = ?");
            stmt.run((new Date()).toISOString(), id);
            stmt.finalize();

            resolve({
                success: true
            });
        });
    }
}
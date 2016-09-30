var express = require('express')
    ,bodyParser = require('body-parser')
    ,extend = require('extend')
    ;

var app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

app.set('views', './views')
app.set('view engine', 'jade');

app.get('/', function (req, res) {
    res.sendFile('public/index.html');
});

// routes
app.use('/battery', require('./routes/battery').battery);
app.use('/events', require('./routes/events').events);
app.use('/event', require('./routes/event').event);
app.use('/temp', require('./routes/temp').temps);

var server = app.listen(8080, function () {

    var host = server.address().address;
    var port = server.address().port;

    console.log('Dashboard app listening at http://%s:%s', host, port);

});

module.exports = {
    init: function () {
        console.log('dash init');
        // db.close();
    }
}
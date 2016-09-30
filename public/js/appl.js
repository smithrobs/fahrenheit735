'use strict'

var CookEvent = React.createClass({displayName: "CookEvent",
  goToEvent: function(){
      var component = React.render(
        React.createElement(CookEventDetails, {data: this.props.evt}),
        document.getElementById('eventDisplay')
      );
      component.updateData();

    $('#eventDisplay').show();
    $('#dashboard').hide();
  },
  render: function() {
    return (
      React.createElement("div", {className: "event"}, 
        React.createElement("span", {className: "eventTitle"}, 
          React.createElement("span", {onClick: this.goToEvent}, this.props.evt.title)
        )
      )
    );
  }
});

var EventList = React.createClass({displayName: "EventList",
  componentDidMount: function() {
      
  },
  render: function() {
    var eventNodes = this.props.data.map(function (evt) {
      return (
        React.createElement(CookEvent, {key: evt.id, evt: evt})
      );
    });
      
    return (
      React.createElement("div", {className: "eventList"}, 
        React.createElement("h2", null, "Events:"), 
        eventNodes
      )
    );
  }
});

///// event details
var CookEventDetails = React.createClass({displayName: "CookEventDetails",
  backToDashboard: function(){
    $('#eventDisplay').hide();
    $('#dashboard').show();
  },
    changeProbe: function(e) {
        this.setState({probeId: parseInt(e.target.innerHTML, 10)});

        document.querySelectorAll("div#eventDisplay .probeSelector").forEach(function (q) {
            q.classList.remove("probeSelected");
        });
        e.target.classList.add("probeSelected");

        this.updateData();
    },
  deleteEvent: function(){
    var me = this;
    vex.dialog.confirm({
        message: 'Delete this event? You can never get it back!',
        callback: function (confirm) {
            if (confirm) {
                  me.backToDashboard();
//                $.ajax('/events/stop', {
//                    contentType: 'application/json',
//                    type: 'POST',
//                    data: JSON.stringify({
//                        id: inEventId
//                    })
//                }).done(function (data) {
//                    $('#eventStart').show();
//                    $('#eventStop').hide();
//                    $('#eventComment').hide();
//                });
            }
        }
    });
  },
    getInitialState: function() {
        return {
            probeId: 1,
            comments: []
        };
    },
  componentDidMount: function() {
    this.updateData();
  },
  // componentDidUpdate: function() {
  //   this.updateData();
  // },

    
  updateData: function() {
      console.log('EVENT DATA UPDATE REQUESTED');
      var me = this;
    $.get('/event/' + this.props.data.id, function (data) {
        me.setState({comments: data.comments});
        
        // historical temp
        var times = [];
        var tempData = [];

        var min = Number.MAX_VALUE,
            max = Number.MIN_VALUE;

        for (var i = 0; i < data.temps.length; i++) {
            var temp = data.temps[i];

            if (temp.probe != me.state.probeId) {
                continue;
            }
            times.push(temp.time);
            tempData.push(temp.temp);

            min = Math.min(min, temp.temp);
            max = Math.max(max, temp.temp);
        }

        // set up history chart
        var ctx = document.getElementById('event_chart');
        var myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: times,
                datasets: [{
                    label: 'temp',
                    data: tempData,
                    backgroundColor:
                        'rgba(255, 99, 132, 0.2)',
                    borderColor:
                        'rgba(255,99,132,1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time'
                    }],
                    yAxes: [{
                        // set scale
                        ticks: {
                            min: min,
                            max: max
                        }
                    }]
                }
            }
        });
        myChart.update();
    });
  },
    
    
  render: function() {
    return (
      React.createElement("div", null,
          React.createElement("h2", null, this.props.data.title),
          React.createElement("div", {className: "probeSelector probeSelected", onClick: this.changeProbe}, '1'),
          React.createElement("div", {className: "probeSelector", onClick: this.changeProbe}, '2'),
          React.createElement("div", {className: "probeSelector", onClick: this.changeProbe}, '3'),
          React.createElement("div", {className: "probeSelector", onClick: this.changeProbe}, '4'),
          React.createElement("div", {id: "event_chart_container"},
            React.createElement("canvas", {id: "event_chart", width: "500", height: "300"})
          ),
          React.createElement("hr", {style: {clear:'left'}}),
          React.createElement("div", null, this.state.comments.map(function(val){
              return (React.createElement("div", {key: val.id}, React.createElement("div", null, val.time), React.createElement("div", null, val.comment)));
          })),
          React.createElement("hr", {style: {clear:'left'}}),
          React.createElement("input", {id: "backToDashboard", type: "button", value: "back", onClick: this.backToDashboard}),
          React.createElement("input", {id: "eventDelete", type: "button", value: "del", onClick: this.deleteEvent})
      )
    );
  }
});





var inEventId = 0;
function refreshCookingEvents() {
    $.get('/event', function (ret) {
        // check for a running event
        ret.events.forEach(function(e) {
            if (null == e.stopTime) {
                inEventId = e.id;
                $('#eventStart').hide();
                $('#eventStop').show();
                $('#eventComment').show();
            }
        });


        React.render(
            React.createElement(EventList, {data: ret.events}),
            document.getElementById('eventList')
        );
    });
}

document.addEventListener("DOMContentLoaded", function (event) {
    ///// cooking events
    refreshCookingEvents();

    ///// chart

    /*
    two types of graphing going on here:
    1. real-time, outside of OR during event
    2. historical across entire event
    */

    moment.relativeTimeThreshold('m', 55);

    Chart.defaults.global.elements.point.radius = 0;
    Chart.defaults.global.elements.point.hitRadius = 3;
    Chart.defaults.global.elements.point.hoverRadius = 5;

    var ctx = document.getElementById("myChart");
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'temp',
                data: [],
                backgroundColor:
                    'rgba(255, 99, 132, 0.2)',
                borderColor:
                    'rgba(255,99,132,1)',
                borderWidth: 1
            }]
        },
        options: {
            legend: {
                display: false
            },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero:true
                    }
                }]
            }
        }
    });

    var cachedTemps = [];
    var updateTempView = function() {
        var times = [];
        var tempData = [];

        for (var i = 0; i < cachedTemps.length; i++) {
            var temp = cachedTemps[i];

            if (temp.probe != selectedProbeDisplay)
                continue;

            times.push(moment(temp.time).fromNow());
            tempData.push(temp.temp);
        }
        myChart.data.datasets[0].data = tempData;
        myChart.data.labels = times;
        myChart.update();

        // show current temp
        // update status
        if (tempData.length === 0) {
            document.getElementById('probeTemp').innerHTML = '-&#176;';
            document.getElementById('status').innerHTML = 'Last updated who knows when';
        } else {
            document.getElementById('probeTemp').innerHTML = tempData[tempData.length - 1] + '&#176;';
            document.getElementById('status').innerHTML = 'Last updated ' + times[times.length - 1];
        }
    };
    var refreshTemp = function () {
        $.get('/temp/current', function (data) {
            cachedTemps = data.temps;

            updateTempView();

            setTimeout(refreshTemp, 10000);
        });
    };

    // setTimeout(updateTemp, 1000);
    refreshTemp();

    var socket = io('http://localhost:3000');
    socket.on('temp', function (data) {
        console.log('%s - probe %d temp %d', data.time, data.probe, data.temp);
        cachedTemps.push(data);
        if (data.probe != selectedProbeDisplay)
            return;
        var dataset = myChart.data.datasets[0].data;
        var datalabels = myChart.data.labels;
        dataset.push(data.temp);
        datalabels.push(moment(data.time).fromNow());
        myChart.update();
        document.getElementById('probeTemp').innerHTML = dataset[dataset.length - 1] + '&#176;';
        document.getElementById('status').innerHTML = 'Last updated ' + datalabels[datalabels.length - 1];
    });

    $.get('/battery', function (data) {
        document.getElementById('batteryLevel').innerHTML = data.percent + '%';
    });

    ///// page events
    var selectedProbeDisplay = 1;

    vex.defaultOptions.className = 'vex-theme-default';
    $('.probeSelector').click(function () {
        selectedProbeDisplay = parseInt(this.innerHTML, 10);
        updateTempView();

        document.querySelectorAll("div#dashboard .probeSelector").forEach(function (q) {
            q.classList.remove("probeSelected");
        });
        this.classList.add("probeSelected");
    });
    $('#eventStart').click(function () {
        vex.dialog.open({
            message: 'Startin\' a smoke? What do you want to call it?',
            input: "<input name=\"eventName\" type=\"text\" placeholder=\"Event Name\" required />",
            buttons: [
                $.extend({}, vex.dialog.buttons.YES, {
                    text: 'Fire it up!'
                }), $.extend({}, vex.dialog.buttons.NO, {
                    text: 'Changed my mind'
                })
            ],
            callback: function (data) {
                if (data === false) {
                    return console.log('Cancelled');
                }

                $.ajax('/events/start', {
                    contentType: 'application/json',
                    type: 'POST',
                    data: JSON.stringify({
                        title: data.eventName
                    })
                }).done(function (data) {
                    refreshCookingEvents();

                    inEventId = data.id;

                    $('#eventStart').hide();
                    $('#eventStop').show();
                    $('#eventComment').show();
                });

                return console.log('event', data.eventName);
            }
        });
    });
    $('#eventStop').click(function () {
        vex.dialog.confirm({
            message: 'Done playing with fire?',
            callback: function (confirm) {
                if (confirm) {
                    $.ajax('/events/stop', {
                        contentType: 'application/json',
                        type: 'POST',
                        data: JSON.stringify({
                            id: inEventId
                        })
                    }).done(function (data) {
                        $('#eventStart').show();
                        $('#eventStop').hide();
                        $('#eventComment').hide();
                    });
                }
            }
        });
    });
    $('#eventComment').click(function () {
        vex.dialog.open({
            message: 'Got something to say?',
            input: "<input name=\"comment\" type=\"text\" placeholder=\"Comment\" required />",
            buttons: [
                $.extend({}, vex.dialog.buttons.YES, {
                    text: 'Okay'
                }), $.extend({}, vex.dialog.buttons.NO, {
                    text: 'Nah'
                })
            ],
            callback: function (data) {
                if (data === false) {
                    return console.log('Cancelled');
                }

                $.ajax('/event/1/comment', {
                    contentType: 'application/json',
                    type: 'POST',
                    data: JSON.stringify({
                        comment: data.comment
                    })
                }).done(function (data) {
                    return console.log('comment', data.comment);
                });
            }
        });
    });
});
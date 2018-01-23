

//var wp = require('seisplotjs-waveformplot');
var wp = seisplotjs_waveformplot;

//let filter = require('seisplotjs-filter');
//filter.doDFT();

wp.createPlotsBySelector('div.myseisplot').then(function() {
  console.log("all plots done");
});
